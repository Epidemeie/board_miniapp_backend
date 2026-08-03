import { Router } from "express";
import { partnersService } from "./service";
import { adminAuth } from "../../middleware/adminAuth";

// Публичный роутер — им пользуется фронтенд Mini App
export const partnersRouter = Router();

partnersRouter.get("/", async (req, res, next) => {
  try {
    const audience = req.query.audience === "provider" ? "provider" : "client";
    res.json(await partnersService.listForAudience(audience));
  } catch (e) {
    next(e);
  }
});

partnersRouter.get("/:id", async (req, res, next) => {
  try {
    const partner = await partnersService.getVisibleById(Number(req.params.id));
    if (!partner) return res.status(404).json({ error: "Партнёр не найден" });
    res.json(partner);
  } catch (e) {
    next(e);
  }
});

// Показ баннера (лента на главной или страница списка) — фронтенд шлёт все
// id, которые реально отрисовались за один раз.
partnersRouter.post("/impressions", async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number).filter((n: number) => Number.isInteger(n)) : [];
    if (ids.length > 0) await partnersService.incrementImpressions(ids);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// Клик «Узнать больше» — открытие карточки конкретного партнёра.
partnersRouter.post("/:id/click", async (req, res, next) => {
  try {
    await partnersService.incrementClick(Number(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// Логотип хранится как data: URI прямо в базе (см. модель Partner) — без
// отдельного файлового хранилища/volume, проще для MVP на одном VPS.
// Ограничение размера — на самой строке, т.к. express.json() уже пропустил
// её мимо своего лимита (см. app.ts, partnersAdminRouter — bodyLimit "2mb").
const MAX_LOGO_DATA_URI_LENGTH = 400_000; // ~300 КБ исходного файла после base64

function validateLogoImage(logoImage: unknown): string | null {
  if (logoImage === undefined || logoImage === null || logoImage === "") return null;
  if (typeof logoImage !== "string" || !/^data:image\/(png|jpe?g|webp|gif);base64,/.test(logoImage)) {
    return "Логотип должен быть изображением (PNG/JPEG/WEBP/GIF)";
  }
  if (logoImage.length > MAX_LOGO_DATA_URI_LENGTH) {
    return "Логотип слишком большой — не больше 300 КБ";
  }
  return null;
}

// Админский роутер — создание/изменение/удаление, защищён Basic Auth
export const partnersAdminRouter = Router();
partnersAdminRouter.use(adminAuth);

partnersAdminRouter.get("/", async (req, res, next) => {
  try {
    res.json(await partnersService.listAll());
  } catch (e) {
    next(e);
  }
});

partnersAdminRouter.post("/", async (req, res, next) => {
  try {
    const err = validateLogoImage(req.body.logoImage);
    if (err) return res.status(400).json({ error: err });
    res.json(await partnersService.create(req.body));
  } catch (e) {
    next(e);
  }
});

partnersAdminRouter.put("/:id", async (req, res, next) => {
  try {
    const err = validateLogoImage(req.body.logoImage);
    if (err) return res.status(400).json({ error: err });
    res.json(await partnersService.update(Number(req.params.id), req.body));
  } catch (e) {
    next(e);
  }
});

partnersAdminRouter.delete("/:id", async (req, res, next) => {
  try {
    await partnersService.remove(Number(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
