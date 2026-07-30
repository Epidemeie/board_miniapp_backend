import { Provider, ProviderArea, ProviderService } from "@prisma/client";

// Веса ровно как в документе: услуга 30% / расстояние 20% / цена 15% / рейтинг 15% / отзывы 10% / скорость 10%
export const MATCH_WEIGHTS = {
  service: 30,
  distance: 20,
  price: 15,
  rating: 15,
  reviews: 10,
  speed: 10,
};

type ProviderWithRelations = Provider & { areas: ProviderArea[]; services: ProviderService[] };

export function scoreProvider(
  provider: ProviderWithRelations,
  params: { area?: string | null; budget?: number | null }
) {
  // Услуга уже гарантированно совпадает — кандидатов отбираем заранее по service_id
  const serviceScore = 100;

  const distanceScore =
    params.area && provider.areas.some((a) => a.area === params.area) ? 100 : 45;

  const priceScore = (() => {
    if (!params.budget || !provider.priceFrom) return 70;
    if (provider.priceFrom <= params.budget) return 100;
    const over = (provider.priceFrom - params.budget) / params.budget;
    return Math.max(20, Math.round(100 - over * 100));
  })();

  const ratingScore = Math.round((provider.rating / 5) * 100);
  const reviewsScore = Math.min(100, provider.reviewCount * 4);
  const speedScore = Math.max(10, Math.round(100 - provider.responseTimeMin * 2));

  const breakdown = {
    service: serviceScore,
    distance: distanceScore,
    price: priceScore,
    rating: ratingScore,
    reviews: reviewsScore,
    speed: speedScore,
  };

  const overall = Math.round(
    (serviceScore * MATCH_WEIGHTS.service +
      distanceScore * MATCH_WEIGHTS.distance +
      priceScore * MATCH_WEIGHTS.price +
      ratingScore * MATCH_WEIGHTS.rating +
      reviewsScore * MATCH_WEIGHTS.reviews +
      speedScore * MATCH_WEIGHTS.speed) /
      100
  );

  return { overall, breakdown };
}
