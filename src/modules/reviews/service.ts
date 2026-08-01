import { prisma } from "../../db/prisma";

export const reviewsService = {
  create: async (data: {
    telegramId: string;
    name: string;
    requestId: number;
    providerId: number;
    rating: number;
    tags?: string[];
    text?: string;
  }) => {
    const user = await prisma.user.upsert({
      where: { telegramId: data.telegramId },
      update: { name: data.name },
      create: { telegramId: data.telegramId, name: data.name, role: "client" },
    });

    // Отзыв в этом приложении подаётся только через «Завершить заказ», поэтому
    // отзыв и перевод заявки в completed — одно действие, атомарно.
    const review = await prisma.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: {
          requestId: data.requestId,
          providerId: data.providerId,
          userId: user.id,
          rating: data.rating,
          tags: data.tags ?? [],
          text: data.text,
        },
      });

      await tx.request.update({
        where: { id: data.requestId },
        data: { status: "completed" },
      });

      // Пересчитываем средний рейтинг и число отзывов мастера
      const agg = await tx.review.aggregate({
        where: { providerId: data.providerId },
        _avg: { rating: true },
        _count: { rating: true },
      });

      await tx.provider.update({
        where: { id: data.providerId },
        data: { rating: agg._avg.rating ?? 0, reviewCount: agg._count.rating },
      });

      return created;
    });

    return review;
  },

  listForAdmin: () =>
    prisma.review.findMany({
      include: { provider: { include: { user: true } }, user: true },
      orderBy: { id: "desc" },
    }),

  remove: (id: number) => prisma.review.delete({ where: { id } }),
};
