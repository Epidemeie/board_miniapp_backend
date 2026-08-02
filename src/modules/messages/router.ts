import { Router } from "express";
import { messagesService } from "./service";

export const messagesRouter = Router();

// Тред сообщений по заказу — доступен клиенту (владельцу заявки) и
// мастеру (автору принятого отклика), см. messagesService.getThreadContext.
messagesRouter.get("/thread/:requestId", async (req, res, next) => {
  try {
    res.json(await messagesService.getThread(Number(req.params.requestId), String(req.query.telegramId || "")));
  } catch (e) {
    next(e);
  }
});

messagesRouter.post("/thread/:requestId", async (req, res, next) => {
  try {
    res.json(await messagesService.send(Number(req.params.requestId), req.body.telegramId, req.body.text));
  } catch (e) {
    next(e);
  }
});

// Бейдж непрочитанных — для дашборда/списков заказов, role определяет,
// в каком кабинете сейчас пользователь (один и тот же telegramId может быть
// и клиентом, и мастером).
messagesRouter.get("/unread-count", async (req, res, next) => {
  try {
    const role = req.query.role === "provider" ? "provider" : "client";
    res.json(await messagesService.unreadCount(String(req.query.telegramId || ""), role));
  } catch (e) {
    next(e);
  }
});
