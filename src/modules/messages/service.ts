import { prisma } from "../../db/prisma";
import { notifyUser } from "../../bot/bot";

// Чат привязан к заявке (Request), не к отклику: участник со стороны
// мастера — это провайдер принятого отклика (Offer.status === "accepted").
// Пока отклик не принят, треда не существует — доступ к чату открывается
// в тот же момент, что и «заказ» в остальном приложении (offersService.respond).
async function getThreadContext(requestId: number, telegramId: string) {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: {
      user: true,
      service: true,
      offers: { where: { status: "accepted" }, include: { provider: { include: { user: true } } } },
    },
  });
  if (!request) {
    const e: any = new Error("Заявка не найдена");
    e.status = 404;
    throw e;
  }
  const acceptedOffer = request.offers[0];
  if (!acceptedOffer) {
    const e: any = new Error("Чат станет доступен после подтверждения заказа");
    e.status = 409;
    throw e;
  }

  let role: "client" | "provider";
  if (request.user.telegramId === telegramId) role = "client";
  else if (acceptedOffer.provider.user.telegramId === telegramId) role = "provider";
  else {
    const e: any = new Error("Нет доступа к этому чату");
    e.status = 403;
    throw e;
  }

  return { request, acceptedOffer, role };
}

export const messagesService = {
  // Открытие треда = прочтение: сразу помечаем непрочитанные сообщения от
  // собеседника прочитанными, без отдельного эндпоинта markRead — фронт
  // читает тред только когда пользователь его открыл (poll внутри экрана чата).
  getThread: async (requestId: number, telegramId: string) => {
    const { role, acceptedOffer, request } = await getThreadContext(requestId, telegramId);
    const otherRole = role === "client" ? "provider" : "client";

    await prisma.message.updateMany({
      where: { requestId, senderRole: otherRole, readAt: null },
      data: { readAt: new Date() },
    });

    const messages = await prisma.message.findMany({ where: { requestId }, orderBy: { id: "asc" } });
    return {
      role,
      messages,
      otherName: role === "client" ? acceptedOffer.provider.user.name : request.user.name,
      serviceName: request.service.name,
    };
  },

  send: async (requestId: number, telegramId: string, text: string) => {
    const trimmed = (text || "").trim();
    if (!trimmed) {
      const e: any = new Error("Сообщение не может быть пустым");
      e.status = 400;
      throw e;
    }
    const { role, acceptedOffer, request } = await getThreadContext(requestId, telegramId);

    const message = await prisma.message.create({
      data: { requestId, senderRole: role, text: trimmed },
    });

    const recipient = role === "client" ? acceptedOffer.provider.user : request.user;
    const senderName = role === "client" ? request.user.name : acceptedOffer.provider.user.name;
    if (recipient.notifyChat) {
      notifyUser(recipient.telegramId, `💬 ${senderName} по заказу «${request.service.name}»:\n${trimmed}`).catch((e) =>
        console.error("Не удалось уведомить о новом сообщении в чате:", e.message)
      );
    }

    return message;
  },

  // Бейдж непрочитанных для дашборда/списков — по всем тредам, где
  // telegramId участвует в этой роли (клиент — владелец заявки, мастер —
  // автор принятого отклика по ней).
  unreadCount: async (telegramId: string, role: "client" | "provider") => {
    const rows = await prisma.message.findMany({
      where:
        role === "client"
          ? { senderRole: "provider", readAt: null, request: { user: { telegramId } } }
          : {
              senderRole: "client",
              readAt: null,
              request: { offers: { some: { status: "accepted", provider: { user: { telegramId } } } } },
            },
      select: { requestId: true },
    });
    const byRequestId: Record<number, number> = {};
    for (const r of rows) byRequestId[r.requestId] = (byRequestId[r.requestId] || 0) + 1;
    return { total: rows.length, byRequestId };
  },
};
