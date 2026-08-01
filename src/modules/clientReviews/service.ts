import { prisma } from "../../db/prisma";
import { recomputeUserRating } from "../../db/ratings";

// Зеркало reviewsService в обратную сторону: мастер оценивает клиента после
// завершения заказа. В отличие от reviewsService.create, здесь не нужен
// upsert по telegramId — и Provider, и User(клиент) на этот момент уже
// точно существуют (регистрация мастера / создание заявки клиентом).
export const clientReviewsService = {
  create: async (data: {
    providerId: number;
    requestId: number;
    userId: number;
    rating: number;
    tags?: string[];
    text?: string;
  }) => {
    const review = await prisma.$transaction(async (tx) => {
      const created = await tx.clientReview.create({
        data: {
          requestId: data.requestId,
          providerId: data.providerId,
          userId: data.userId,
          rating: data.rating,
          tags: data.tags ?? [],
          text: data.text,
        },
      });

      // Пересчитываем средний рейтинг и число отзывов клиента
      const agg = await tx.clientReview.aggregate({
        where: { userId: data.userId },
        _avg: { rating: true },
        _count: { rating: true },
      });

      await tx.user.update({
        where: { id: data.userId },
        data: { rating: agg._avg.rating ?? 0, reviewCount: agg._count.rating },
      });

      return created;
    });

    return review;
  },

  listForAdmin: () =>
    prisma.clientReview.findMany({
      include: { user: true, provider: { include: { user: true } } },
      orderBy: { id: "desc" },
    }),

  // Симметрично reviewsService.remove — пересчитываем рейтинг клиента
  // после удаления, иначе он остаётся «зависшим».
  remove: async (id: number) => {
    const deleted = await prisma.clientReview.delete({ where: { id } });
    await recomputeUserRating(deleted.userId);
    return deleted;
  },
};
