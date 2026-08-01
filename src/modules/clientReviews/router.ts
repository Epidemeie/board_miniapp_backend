import { Router } from "express";
import { clientReviewsService } from "./service";
import { adminAuth } from "../../middleware/adminAuth";

export const clientReviewsRouter = Router();

// Мастер оставляет отзыв о клиенте — доступно после завершения заказа
// (Request.status === "completed"), см. reviewsRouter (симметричный поток).
clientReviewsRouter.post("/", async (req, res, next) => {
  try {
    res.json(await clientReviewsService.create(req.body));
  } catch (e) {
    next(e);
  }
});

export const clientReviewsAdminRouter = Router();
clientReviewsAdminRouter.use(adminAuth);

clientReviewsAdminRouter.get("/", async (req, res, next) => {
  try {
    res.json(await clientReviewsService.listForAdmin());
  } catch (e) {
    next(e);
  }
});

clientReviewsAdminRouter.delete("/:id", async (req, res, next) => {
  try {
    await clientReviewsService.remove(Number(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
