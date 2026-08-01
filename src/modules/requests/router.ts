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

// Лента открытых заявок под услуги мастера — serviceId может быть списком через запятую
requestsRouter.get("/open", async (req, res, next) => {
  try {
    const serviceIds = String(req.query.serviceId || "")
      .split(",")
      .map(Number)
      .filter((n) => !Number.isNaN(n));
    const telegramId = req.query.telegramId ? String(req.query.telegramId) : undefined;
    res.json(await requestsService.listOpen(serviceIds, telegramId));
  } catch (e) {
    next(e);
  }
});

// Заявки клиента + отклики по ним
requestsRouter.get("/mine", async (req, res, next) => {
  try {
    res.json(await requestsService.listMine(String(req.query.telegramId)));
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

// Клиент удаляет свою заявку (только пока она открыта) — уходит в архив
requestsRouter.put("/:id/archive", async (req, res, next) => {
  try {
    res.json(await requestsService.archive(Number(req.params.id), String(req.body.telegramId)));
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

requestsAdminRouter.delete("/:id", async (req, res, next) => {
  try {
    await requestsService.remove(Number(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
