import { Router } from "express";
import { prisma } from "../../db/prisma";
import { adminAuth } from "../../middleware/adminAuth";

export const adminStatsRouter = Router();
adminStatsRouter.use(adminAuth);

// Аналитика для главного экрана админки — ровно те цифры, что перечислены в документе
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
    });
  } catch (e) {
    next(e);
  }
});
