import { Router } from "express";
import { usersService } from "./service";
import { adminAuth } from "../../middleware/adminAuth";

// Клиенты видны и управляются только из админки — публичного роутера нет,
// фронтенд отдельной "учётки клиента" не показывает (см. CLAUDE-frontend.md)
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
