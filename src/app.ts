import express from "express";
import cors from "cors";
import path from "path";
import { errorHandler } from "./middleware/errorHandler";

import { categoriesRouter, categoriesAdminRouter } from "./modules/categories/router";
import { servicesRouter, servicesAdminRouter } from "./modules/services/router";
import { providersRouter, providersAdminRouter } from "./modules/providers/router";
import { requestsRouter, requestsAdminRouter } from "./modules/requests/router";
import { offersRouter } from "./modules/offers/router";
import { reviewsRouter, reviewsAdminRouter } from "./modules/reviews/router";
import { clientReviewsRouter, clientReviewsAdminRouter } from "./modules/clientReviews/router";
import { authRouter } from "./modules/auth/router";
import { adminStatsRouter } from "./modules/admin/router";
import { usersRouter, usersAdminRouter } from "./modules/users/router";
import { subscriptionsRouter, subscriptionsAdminRouter } from "./modules/subscriptions/router";

export function createApp() {
  const app = express();

  app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") ?? "*" }));
  app.use(express.json());

  // ---- Публичное API — им пользуется Mini App (фронтенд) ----
  app.use("/api/categories", categoriesRouter);
  app.use("/api/services", servicesRouter);
  app.use("/api/providers", providersRouter);
  app.use("/api/requests", requestsRouter);
  app.use("/api/offers", offersRouter);
  app.use("/api/reviews", reviewsRouter);
  app.use("/api/client-reviews", clientReviewsRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/subscriptions", subscriptionsRouter);

  // ---- Админ API — каждый раздел подключается отдельной строкой.  ----
  // ---- Чтобы убрать модуль целиком — достаточно закомментировать одну строку ----
  app.use("/api/admin/categories", categoriesAdminRouter);
  app.use("/api/admin/services", servicesAdminRouter);
  app.use("/api/admin/providers", providersAdminRouter);
  app.use("/api/admin/requests", requestsAdminRouter);
  app.use("/api/admin/reviews", reviewsAdminRouter);
  app.use("/api/admin/client-reviews", clientReviewsAdminRouter);
  app.use("/api/admin/users", usersAdminRouter);
  app.use("/api/admin/subscriptions", subscriptionsAdminRouter);
  app.use("/api/admin", adminStatsRouter);

  // ---- Статическая админ-панель (public/admin) ----
  app.use("/admin", express.static(path.join(__dirname, "..", "public", "admin")));

  app.get("/health", (req, res) => res.json({ ok: true }));

  app.use(errorHandler);

  return app;
}
