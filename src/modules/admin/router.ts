import { Router } from "express";
import { prisma } from "../../db/prisma";
import { adminAuth } from "../../middleware/adminAuth";
import { recomputeProviderRating, recomputeUserRating } from "../../db/ratings";

export const adminStatsRouter = Router();
adminStatsRouter.use(adminAuth);

// Аналитика для главного экрана админки — ровно те цифры, что перечислены в документе,
// плюс блок доп. метрик ниже (динамика, незакрытый спрос, ниши/районы, статусы,
// повторные клиенты) — добавлены по запросу, см. CLAUDE-backend.md.
adminStatsRouter.get("/stats", async (req, res, next) => {
  try {
    const [users, providers, requests, offers, reviews] = await Promise.all([
      prisma.user.count(),
      prisma.provider.count(),
      prisma.request.count(),
      prisma.offer.count(),
      prisma.review.count(),
    ]);

    const requestsWithOffers = await prisma.request.count({ where: { offers: { some: {} } } });
    const requestsMatched = await prisma.request.count({ where: { status: "matched" } });

    const now = Date.now();
    const since7 = new Date(now - 7 * 24 * 3600_000);
    const since30 = new Date(now - 30 * 24 * 3600_000);

    const [newUsers7, newUsers30, newProviders7, newProviders30, newRequests7, newRequests30] = await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: since7 } } }),
      prisma.user.count({ where: { createdAt: { gte: since30 } } }),
      prisma.provider.count({ where: { createdAt: { gte: since7 } } }),
      prisma.provider.count({ where: { createdAt: { gte: since30 } } }),
      prisma.request.count({ where: { createdAt: { gte: since7 } } }),
      prisma.request.count({ where: { createdAt: { gte: since30 } } }),
    ]);

    // Незакрытый спрос: открытые заявки без единого отклика — и среднее
    // время от создания заявки до момента, когда отклик приняли (по всем
    // когда-либо принятым откликам, не только свежим).
    const [openNoOffers, acceptedWithRequest] = await Promise.all([
      prisma.request.count({ where: { status: "open", archived: false, offers: { none: {} } } }),
      prisma.offer.findMany({
        where: { status: "accepted" },
        select: { createdAt: true, request: { select: { createdAt: true } } },
      }),
    ]);
    const avgAcceptHours = acceptedWithRequest.length
      ? Math.round(
          (acceptedWithRequest.reduce((sum, o) => sum + (o.createdAt.getTime() - o.request.createdAt.getTime()), 0) /
            acceptedWithRequest.length /
            3_600_000) *
            10
        ) / 10
      : null;

    // Спрос по нишам и районам — топ-8, чтобы не раздувать ответ на маленьких
    // и на будущих больших объёмах данных одинаково.
    const [byService, byArea, byStatus, archivedCount, clientsWithRequests] = await Promise.all([
      prisma.request.groupBy({ by: ["serviceId"], _count: { _all: true }, orderBy: { _count: { serviceId: "desc" } }, take: 8 }),
      prisma.request.groupBy({
        by: ["area"],
        _count: { _all: true },
        where: { area: { not: null } },
        orderBy: { _count: { area: "desc" } },
        take: 8,
      }),
      // archived — отдельный флаг (см. requestsService.archive), не смена status:
      // удалённая клиентом заявка остаётся status "open" навсегда. Без фильтра
      // архивная заявка задваивала счётчик "open" — вместо этого ниже считаем
      // архивные отдельным синтетическим статусом "archived".
      prisma.request.groupBy({ by: ["status"], _count: { _all: true }, where: { archived: false } }),
      prisma.request.count({ where: { archived: true } }),
      prisma.user.findMany({ where: { requests: { some: {} } }, select: { _count: { select: { requests: true } } } }),
    ]);
    const services = await prisma.service.findMany({ where: { id: { in: byService.map((s) => s.serviceId) } } });
    const topServices = byService.map((s) => ({
      name: services.find((sv) => sv.id === s.serviceId)?.name ?? "—",
      count: s._count._all,
    }));
    const topAreas = byArea.map((a) => ({ area: a.area, count: a._count._all }));
    const requestsByStatus = Object.fromEntries(byStatus.map((s) => [s.status, s._count._all]));
    if (archivedCount > 0) requestsByStatus.archived = archivedCount;
    const repeatClients = clientsWithRequests.filter((u) => u._count.requests > 1).length;

    res.json({
      users,
      providers,
      requests,
      offers,
      reviews,
      conversion: {
        requestToOffer: requests ? Math.round((requestsWithOffers / requests) * 100) : 0,
        requestToOrder: requests ? Math.round((requestsMatched / requests) * 100) : 0,
      },
      growth: {
        last7: { users: newUsers7, providers: newProviders7, requests: newRequests7 },
        last30: { users: newUsers30, providers: newProviders30, requests: newRequests30 },
      },
      unmetDemand: { openNoOffers, avgAcceptHours },
      demand: { topServices, topAreas },
      requestsByStatus,
      repeatClients,
    });
  } catch (e) {
    next(e);
  }
});

// Ручной пересчёт рейтингов всех мастеров и клиентов — на случай, если
// где-то в прошлом отзыв удалился (напрямую или каскадом при удалении
// заявки), а рейтинг остался «зависшим» на старом значении. Сама точка
// удаления отзыва теперь пересчитывает рейтинг сразу (см. reviewsService,
// clientReviewsService, requestsService.remove) — это разовая починка
// уже накопленного расхождения, не то, что должно вызываться регулярно.
adminStatsRouter.post("/recompute-ratings", async (req, res, next) => {
  try {
    const [providers, users] = await Promise.all([
      prisma.provider.findMany({ select: { id: true } }),
      prisma.user.findMany({ select: { id: true } }),
    ]);
    await Promise.all([
      ...providers.map((p) => recomputeProviderRating(p.id)),
      ...users.map((u) => recomputeUserRating(u.id)),
    ]);
    res.json({ ok: true, providers: providers.length, users: users.length });
  } catch (e) {
    next(e);
  }
});
