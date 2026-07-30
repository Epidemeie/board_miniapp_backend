import { Router } from "express";
import { reviewsService } from "./service";
import { adminAuth } from "../../middleware/adminAuth";

export const reviewsRouter = Router();

reviewsRouter.post("/", async (req, res, next) => {
  try {
    res.json(await reviewsService.create(req.body));
  } catch (e) {
    next(e);
  }
});

export const reviewsAdminRouter = Router();
reviewsAdminRouter.use(adminAuth);

reviewsAdminRouter.get("/", async (req, res, next) => {
  try {
    res.json(await reviewsService.listForAdmin());
  } catch (e) {
    next(e);
  }
});

reviewsAdminRouter.delete("/:id", async (req, res, next) => {
  try {
    await reviewsService.remove(Number(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
