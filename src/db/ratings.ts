import { prisma } from "./prisma";

// Пересчёт агрегатов рейтинга — нужен везде, где отзыв (Review/ClientReview)
// может исчезнуть: не только при создании нового отзыва (там он уже был
// инлайн в транзакции create), но и при удалении — напрямую через админку
// или каскадом при удалении заявки. Без этого рейтинг остаётся «зависшим»
// на старом значении, хотя отзывов за ним больше нет — реальный баг,
// пойманный на удалении отзыва мастеру через админку.
export async function recomputeProviderRating(providerId: number) {
  const agg = await prisma.review.aggregate({
    where: { providerId },
    _avg: { rating: true },
    _count: { rating: true },
  });
  await prisma.provider.update({
    where: { id: providerId },
    data: { rating: agg._avg.rating ?? 0, reviewCount: agg._count.rating },
  });
}

export async function recomputeUserRating(userId: number) {
  const agg = await prisma.clientReview.aggregate({
    where: { userId },
    _avg: { rating: true },
    _count: { rating: true },
  });
  await prisma.user.update({
    where: { id: userId },
    data: { rating: agg._avg.rating ?? 0, reviewCount: agg._count.rating },
  });
}
