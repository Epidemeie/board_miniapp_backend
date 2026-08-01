import { Router } from "express";
import { providersService } from "./service";
import { adminAuth } from "../../middleware/adminAuth";

export const providersRouter = Router();

providersRouter.get("/", async (req, res, next) => {
  try {
    res.json(await providersService.list());
  } catch (e) {
    next(e);
  }
});

// Фронтенд проверяет здесь, зарегистрирован ли открывший Mini App как мастер
providersRouter.get("/by-telegram/:telegramId", async (req, res, next) => {
  try {
    res.json(await providersService.getByTelegramId(req.params.telegramId));
  } catch (e) {
    next(e);
  }
});

// Самостоятельная регистрация мастера из Mini App (без админки), verified: false по умолчанию
providersRouter.post("/register", async (req, res, next) => {
  try {
    res.json(await providersService.create(req.body));
  } catch (e) {
    next(e);
  }
});

providersRouter.get("/:id", async (req, res, next) => {
  try {
    const provider = await providersService.get(Number(req.params.id));
    if (!provider) return res.status(404).json({ error: "Мастер не найден" });
    res.json(provider);
  } catch (e) {
    next(e);
  }
});

// Мастер удаляет свой профиль — мягко, см. providersService.deactivate
providersRouter.put("/:id/deactivate", async (req, res, next) => {
  try {
    res.json(await providersService.deactivate(Number(req.params.id), req.body.telegramId));
  } catch (e) {
    next(e);
  }
});

export const providersAdminRouter = Router();
providersAdminRouter.use(adminAuth);

// Админка видит и заблокированных, и неподтверждённых мастеров
providersAdminRouter.get("/", async (req, res, next) => {
  try {
    res.json(await providersService.listAllForAdmin());
  } catch (e) {
    next(e);
  }
});

// Детальная карточка мастера для админки: статистика и история откликов/отзывов
providersAdminRouter.get("/:id", async (req, res, next) => {
  try {
    const provider = await providersService.getAdminDetail(Number(req.params.id));
    if (!provider) return res.status(404).json({ error: "Мастер не найден" });
    res.json(provider);
  } catch (e) {
    next(e);
  }
});

providersAdminRouter.post("/", async (req, res, next) => {
  try {
    res.json(await providersService.create(req.body));
  } catch (e) {
    next(e);
  }
});

providersAdminRouter.put("/:id", async (req, res, next) => {
  try {
    res.json(await providersService.update(Number(req.params.id), req.body));
  } catch (e) {
    next(e);
  }
});

providersAdminRouter.delete("/:id", async (req, res, next) => {
  try {
    await providersService.remove(Number(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
