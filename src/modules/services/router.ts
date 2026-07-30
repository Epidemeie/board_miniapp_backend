import { Router } from "express";
import { servicesService } from "./service";
import { adminAuth } from "../../middleware/adminAuth";

export const servicesRouter = Router();

// ?categoryId=1 — услуги внутри категории (то, что открывает фронтенд после выбора категории)
servicesRouter.get("/", async (req, res, next) => {
  try {
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
    res.json(categoryId ? await servicesService.listByCategory(categoryId) : await servicesService.list());
  } catch (e) {
    next(e);
  }
});

export const servicesAdminRouter = Router();
servicesAdminRouter.use(adminAuth);

servicesAdminRouter.post("/", async (req, res, next) => {
  try {
    res.json(await servicesService.create(req.body));
  } catch (e) {
    next(e);
  }
});

servicesAdminRouter.put("/:id", async (req, res, next) => {
  try {
    res.json(await servicesService.update(Number(req.params.id), req.body));
  } catch (e) {
    next(e);
  }
});

servicesAdminRouter.delete("/:id", async (req, res, next) => {
  try {
    await servicesService.remove(Number(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
