import { prisma } from "../../db/prisma";
import { subscriptionsService } from "../subscriptions/service";
import { notifyUser } from "../../bot/bot";

export const offersService = {
  // Списание за лид и создание отклика — одной транзакцией: если списание
  // упало (нехватка средств) или отклик не создался — откатывается всё,
  // не бывает ситуации «деньги списали, отклик не появился».
  create: async (data: { requestId: number; providerId: number; price: number; comment?: string }) => {
    const offer = await prisma.$transaction(async (tx) => {
      await subscriptionsService.chargeLead(data.providerId, data.requestId, tx);
      return tx.offer.create({ data });
    });

    // Уведомление клиенту — не await, см. notifyUser в src/bot/bot.ts.
    prisma.offer
      .findUniqueOrThrow({
        where: { id: offer.id },
        include: { request: { include: { user: true, service: true } }, provider: { include: { user: true } } },
      })
      .then((full) => {
        if (!full.request.user.notifyOrders) return;
        const text = [
          `📩 Новый отклик на вашу заявку «${full.request.service.name}»`,
          `Мастер: ${full.provider.user.name}`,
          `Цена: ${full.price} ₾`,
          full.comment ? `Комментарий: ${full.comment}` : null,
        ]
          .filter(Boolean)
          .join("\n");
        return notifyUser(full.request.user.telegramId, text);
      })
      .catch((e) => console.error("Не удалось уведомить клиента о новом отклике:", e.message));

    return offer;
  },

  respond: async (id: number, status: "accepted" | "declined") => {
    const offer = await prisma.offer.update({
      where: { id },
      data: { status },
      include: { request: { include: { service: true } }, provider: { include: { user: true } } },
    });
    if (status === "accepted") {
      await prisma.request.update({ where: { id: offer.requestId }, data: { status: "matched" } });
      if (offer.provider.user.notifyOrders) {
        const text = `✅ Клиент выбрал вас по заявке «${offer.request.service.name}». Заказ подтверждён.`;
        notifyUser(offer.provider.user.telegramId, text).catch((e) =>
          console.error("Не удалось уведомить мастера о подтверждении заказа:", e.message)
        );
      }
    }
    return offer;
  },

  listForRequest: (requestId: number) =>
    prisma.offer.findMany({
      where: { requestId },
      include: { provider: { include: { user: true } } },
    }),

  // Отклики конкретного мастера + заявки, на которые он откликался — экран
  // «Заявки»/«Заказы» в личном кабинете мастера. clientReviews нужен, чтобы
  // понять, оставил ли мастер уже отзыв о клиенте по этой заявке.
  listForProvider: (providerId: number) =>
    prisma.offer.findMany({
      where: { providerId },
      include: { request: { include: { service: true, user: true, clientReviews: true } } },
      orderBy: { id: "desc" },
    }),
};
