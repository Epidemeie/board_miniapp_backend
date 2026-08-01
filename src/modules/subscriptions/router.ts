import { Router } from "express";
import { subscriptionsService } from "./service";
import { adminAuth } from "../../middleware/adminAuth";
import { prisma } from "../../db/prisma";

export const subscriptionsRouter = Router();

// Мастер смотрит свой тариф/баланс/историю — экран «Мой тариф» (на будущее)
subscriptionsRouter.get("/status", async (req, res, next) => {
  try {
    res.json(await subscriptionsService.getStatusByTelegramId(String(req.query.telegramId)));
  } catch (e) {
    next(e);
  }
});

export const subscriptionsAdminRouter = Router();
subscriptionsAdminRouter.use(adminAuth);

// Начислить баланс мастеру вручную — компенсации, тестовые аккаунты,
// индивидуальные договорённости с первыми мастерами
subscriptionsAdminRouter.post("/topup", async (req, res, next) => {
  try {
    const { providerId, amount, comment } = req.body;
    res.json(await subscriptionsService.topUp(Number(providerId), Number(amount), comment));
  } catch (e) {
    next(e);
  }
});

// Выдать/продлить Pro на N месяцев вручную
subscriptionsAdminRouter.post("/pro", async (req, res, next) => {
  try {
    const { providerId, months } = req.body;
    res.json(await subscriptionsService.activatePro(Number(providerId), Number(months)));
  } catch (e) {
    next(e);
  }
});

// Журнал операций — для вкладки «Монетизация» в админке
subscriptionsAdminRouter.get("/transactions", async (req, res, next) => {
  try {
    res.json(
      await prisma.transaction.findMany({
        include: { provider: { include: { user: true } } },
        orderBy: { createdAt: "desc" },
        take: 200,
      })
    );
  } catch (e) {
    next(e);
  }
});
