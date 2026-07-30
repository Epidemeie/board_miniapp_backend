import { Router } from "express";
import { verifyTelegramInitData } from "./telegram";

export const authRouter = Router();

// Фронтенд присылает сюда window.Telegram.WebApp.initData при открытии Mini App
authRouter.post("/telegram", (req, res) => {
  const { initData } = req.body;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) return res.status(500).json({ error: "TELEGRAM_BOT_TOKEN не настроен на сервере" });
  if (!initData) return res.status(400).json({ error: "initData отсутствует" });

  const valid = verifyTelegramInitData(initData, botToken);
  if (!valid) return res.status(401).json({ error: "Не удалось подтвердить подлинность данных Telegram" });

  const params = new URLSearchParams(initData);
  const user = JSON.parse(params.get("user") || "{}");
  res.json({ ok: true, user });
});
