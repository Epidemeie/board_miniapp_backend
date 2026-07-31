import { prisma } from "../../db/prisma";

export const offersService = {
  create: (data: { requestId: number; providerId: number; price: number; comment?: string }) =>
    prisma.offer.create({ data }),

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
  // «Заявки»/«Заказы» в личном кабинете мастера
  listForProvider: (providerId: number) =>
    prisma.offer.findMany({
      where: { providerId },
      include: { request: { include: { service: true, user: true } } },
      orderBy: { id: "desc" },
    }),
};
