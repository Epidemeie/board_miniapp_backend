import { Router } from "express";
import { categoriesService } from "./service";
import { adminAuth } from "../../middleware/adminAuth";

// Публичный роутер — им пользуется фронтенд Mini App
export const categoriesRouter = Router();

categoriesRouter.get("/", async (req, res, next) => {
  try {
    res.json(await categoriesService.list());
  } catch (e) {
    next(e);
  }
});

// Админский роутер — создание/изменение/удаление, защищён Basic Auth
export const categoriesAdminRouter = Router();
categoriesAdminRouter.use(adminAuth);

categoriesAdminRouter.post("/", async (req, res, next) => {
  try {
    res.json(await categoriesService.create(req.body));
  } catch (e) {
    next(e);
  }
});

categoriesAdminRouter.put("/:id", async (req, res, next) => {
  try {
    res.json(await categoriesService.update(Number(req.params.id), req.body));
  } catch (e) {
    next(e);
  }
});

categoriesAdminRouter.delete("/:id", async (req, res, next) => {
  try {
    await categoriesService.remove(Number(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
