import { prisma } from "../../db/prisma";
import { recomputeProviderRating } from "../../db/ratings";
import { notifyUser } from "../../bot/bot";

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

      const provider = await tx.provider.update({
        where: { id: data.providerId },
        data: { rating: agg._avg.rating ?? 0, reviewCount: agg._count.rating },
        include: { user: true },
      });

      return { created, provider };
    });

    if (review.provider.notifyReviews) {
      const text = `⭐ Новый отзыв от клиента: ${review.created.rating}/5${review.created.text ? `\n«${review.created.text}»` : ""}`;
      notifyUser(review.provider.user.telegramId, text).catch((e) =>
        console.error("Не удалось уведомить мастера о новом отзыве:", e.message)
      );
    }

    return review.created;
  },

  listForAdmin: () =>
    prisma.review.findMany({
      include: { provider: { include: { user: true } }, user: true },
      orderBy: { id: "desc" },
    }),

  // Удаление отзыва (модерация) должно пересчитать рейтинг мастера —
  // иначе он «зависает» на старом значении, хотя отзывов за ним уже нет.
  remove: async (id: number) => {
    const deleted = await prisma.review.delete({ where: { id } });
    await recomputeProviderRating(deleted.providerId);
    return deleted;
  },
};
