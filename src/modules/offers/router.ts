import { Router } from "express";
import { offersService } from "./service";

export const offersRouter = Router();

// Мастер отправляет отклик на заявку
offersRouter.post("/", async (req, res, next) => {
  try {
    res.json(await offersService.create(req.body));
  } catch (e) {
    next(e);
  }
});

// Клиент смотрит все отклики по своей заявке
offersRouter.get("/request/:requestId", async (req, res, next) => {
  try {
    res.json(await offersService.listForRequest(Number(req.params.requestId)));
  } catch (e) {
    next(e);
  }
});

// Мастер смотрит все свои отклики — экран «Заявки»/«Заказы» в личном кабинете
offersRouter.get("/mine", async (req, res, next) => {
  try {
    res.json(await offersService.listForProvider(Number(req.query.providerId)));
  } catch (e) {
    next(e);
  }
});

// Клиент выбирает или отклоняет отклик
offersRouter.put("/:id/respond", async (req, res, next) => {
  try {
    res.json(await offersService.respond(Number(req.params.id), req.body.status));
  } catch (e) {
    next(e);
  }
});
