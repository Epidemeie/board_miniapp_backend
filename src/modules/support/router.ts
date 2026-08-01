import { Router } from "express";
import { supportService } from "./service";
import { adminAuth } from "../../middleware/adminAuth";

export const supportRouter = Router();

// Отправка обращения из личного кабинета (форма «Тема» + «Сообщение», не чат)
supportRouter.post("/", async (req, res, next) => {
  try {
    const { telegramId, name, username, role, subject, text } = req.body;
    if (!telegramId || !name || !text?.trim()) {
      const e: any = new Error("Заполните обращение");
      e.status = 400;
      throw e;
    }
    if (role !== "client" && role !== "provider") {
      const e: any = new Error("Некорректная роль обращения");
      e.status = 400;
      throw e;
    }
    res.json(
      await supportService.create({
        telegramId,
        name,
        username,
        role,
        subject: subject?.trim() || undefined,
        text: text.trim(),
      })
    );
  } catch (e) {
    next(e);
  }
});

export const supportAdminRouter = Router();
supportAdminRouter.use(adminAuth);

supportAdminRouter.get("/", async (req, res, next) => {
  try {
    res.json(await supportService.listForAdmin());
  } catch (e) {
    next(e);
  }
});
