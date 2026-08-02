import { Router } from "express";
import { usersService } from "./service";
import { adminAuth } from "../../middleware/adminAuth";

// Публичный роутер — сохранённые предпочтения входа (язык, роль) по
// telegramId, экраны language/role должны появляться только один раз.
// Остальное про клиентов — только из админки, см. usersAdminRouter ниже.
export const usersRouter = Router();

usersRouter.get("/prefs/:telegramId", async (req, res, next) => {
  try {
    res.json(await usersService.getPrefs(req.params.telegramId));
  } catch (e) {
    next(e);
  }
});

usersRouter.put("/prefs", async (req, res, next) => {
  try {
    const { telegramId, name, username, language, entryRole, notifyOrders, notifyReviews, notifyChat } = req.body;
    await usersService.setPrefs({ telegramId, name, username, language, entryRole, notifyOrders, notifyReviews, notifyChat });
    res.json({ language, entryRole, notifyOrders, notifyReviews, notifyChat });
  } catch (e) {
    next(e);
  }
});

// Клиент удаляет свой аккаунт — мягко (см. usersService.deactivate):
// профиль и рейтинг сохраняются, реактивация происходит автоматически
// при следующем выборе роли «клиент» (см. setPrefs выше).
usersRouter.put("/deactivate", async (req, res, next) => {
  try {
    await usersService.deactivate(req.body.telegramId);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// Публичный профиль клиента (рейтинг + отзывы от мастеров) — симметрично
// providersRouter.get("/by-telegram/:telegramId") и providersRouter.get("/:id").
usersRouter.get("/by-telegram/:telegramId", async (req, res, next) => {
  try {
    res.json(await usersService.getPublicByTelegramId(req.params.telegramId));
  } catch (e) {
    next(e);
  }
});

usersRouter.get("/:id", async (req, res, next) => {
  try {
    const user = await usersService.getPublicDetail(Number(req.params.id));
    if (!user) return res.status(404).json({ error: "Клиент не найден" });
    res.json(user);
  } catch (e) {
    next(e);
  }
});

export const usersAdminRouter = Router();
usersAdminRouter.use(adminAuth);

usersAdminRouter.get("/", async (req, res, next) => {
  try {
    res.json(await usersService.list());
  } catch (e) {
    next(e);
  }
});

usersAdminRouter.get("/:id", async (req, res, next) => {
  try {
    const user = await usersService.getDetail(Number(req.params.id));
    if (!user) return res.status(404).json({ error: "Клиент не найден" });
    res.json(user);
  } catch (e) {
    next(e);
  }
});

usersAdminRouter.put("/:id", async (req, res, next) => {
  try {
    res.json(await usersService.update(Number(req.params.id), req.body));
  } catch (e) {
    next(e);
  }
});

usersAdminRouter.delete("/:id", async (req, res, next) => {
  try {
    await usersService.remove(Number(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
