import { prisma } from "../../db/prisma";
import { subscriptionsService } from "../subscriptions/service";

export const offersService = {
  // Списание за лид и создание отклика — одной транзакцией: если списание
  // упало (нехватка средств) или отклик не создался — откатывается всё,
  // не бывает ситуации «деньги списали, отклик не появился».
  create: (data: { requestId: number; providerId: number; price: number; comment?: string }) =>
    prisma.$transaction(async (tx) => {
      await subscriptionsService.chargeLead(data.providerId, data.requestId, tx);
      return tx.offer.create({ data });
    }),

  respond: async (id: number, status: "accepted" | "declined") => {
    const offer = await prisma.offer.update({ where: { id }, data: { status } });
    if (status === "accepted") {
      await prisma.request.update({ where: { id: offer.requestId }, data: { status: "matched" } });
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
