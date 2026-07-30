import { Router } from "express";
import { requestsService } from "./service";
import { adminAuth } from "../../middleware/adminAuth";

export const requestsRouter = Router();

requestsRouter.post("/", async (req, res, next) => {
  try {
    res.json(await requestsService.create(req.body));
  } catch (e) {
    next(e);
  }
});

// Ключевой публичный эндпоинт: подобрать мастеров под конкретную заявку
requestsRouter.get("/:id/candidates", async (req, res, next) => {
  try {
    const result = await requestsService.matchCandidates(Number(req.params.id));
    if (!result) return res.status(404).json({ error: "Заявка не найдена" });
    res.json(result);
  } catch (e) {
    next(e);
  }
});

export const requestsAdminRouter = Router();
requestsAdminRouter.use(adminAuth);

requestsAdminRouter.get("/", async (req, res, next) => {
  try {
    res.json(await requestsService.listForAdmin());
  } catch (e) {
    next(e);
  }
});

requestsAdminRouter.get("/:id", async (req, res, next) => {
  try {
    const r = await requestsService.get(Number(req.params.id));
    if (!r) return res.status(404).json({ error: "Не найдено" });
    res.json(r);
  } catch (e) {
    next(e);
  }
});

requestsAdminRouter.put("/:id/status", async (req, res, next) => {
  try {
    res.json(await requestsService.updateStatus(Number(req.params.id), req.body.status));
  } catch (e) {
    next(e);
  }
});
