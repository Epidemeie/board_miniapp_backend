import { Prisma, Provider } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { PRICING, Tier } from "./pricing";

type TxOrPrisma = Prisma.TransactionClient | typeof prisma;

// Единственный источник истины о тарифе мастера — pro только если явно
// выставлен tier: "pro" И срок ещё не истёк. Нигде в коде не читать
// provider.tier напрямую, иначе истёкшая подписка продолжит работать.
export function getEffectiveTier(provider: Pick<Provider, "tier" | "tierUntil">): Tier {
  if (provider.tier === "pro" && provider.tierUntil && provider.tierUntil.getTime() > Date.now()) {
    return "pro";
  }
  return "free";
}

export const subscriptionsService = {
  getEffectiveTier,

  // Списание за отклик на заявку. Идемпотентно — вторая попытка списать за
  // ту же пару (мастер, заявка) ничего не списывает повторно, просто
  // возвращает уже существующую запись. Принимает опциональный tx, чтобы
  // вызывающий код (offers/service.ts) мог включить списание в ту же
  // Prisma-транзакцию, что и создание отклика.
  chargeLead: async (providerId: number, requestId: number, tx: TxOrPrisma = prisma) => {
    const existing = await tx.leadCharge.findUnique({
      where: { providerId_requestId: { providerId, requestId } },
    });
    if (existing) return existing;

    const provider = await tx.provider.findUnique({ where: { id: providerId } });
    if (!provider) {
      const e: any = new Error("Мастер не найден");
      e.status = 404;
      throw e;
    }

    const tier = getEffectiveTier(provider);
    const price = PRICING[tier].leadPrice;

    if (price === 0) {
      // Рабочий режим на старте: статистика (LeadCharge) копится, денег
      // никто не платит — Transaction не создаём, баланс не трогаем.
      return tx.leadCharge.create({ data: { providerId, requestId, amount: 0, tier } });
    }

    // Проверка баланса и его уменьшение — одна атомарная операция:
    // условный update, который сам проверяет достаточность средств.
    // Если бы это были два отдельных шага, два почти одновременных отклика
    // могли бы оба пройти проверку и увести баланс в минус.
    const updated = await tx.provider.updateMany({
      where: { id: providerId, balance: { gte: price } },
      data: { balance: { decrement: price } },
    });
    if (updated.count === 0) {
      const e: any = new Error("Недостаточно средств на балансе");
      e.status = 400;
      throw e;
    }

    const [charge] = await Promise.all([
      tx.leadCharge.create({ data: { providerId, requestId, amount: price, tier } }),
      tx.transaction.create({
        data: { providerId, type: "lead", amount: -price, comment: `Списание за отклик на заявку #${requestId}` },
      }),
    ]);
    return charge;
  },

  // Ручное пополнение баланса из админки.
  topUp: async (providerId: number, amount: number, comment?: string) => {
    if (!Number.isInteger(amount) || amount <= 0) {
      const e: any = new Error("Сумма пополнения должна быть положительным целым числом");
      e.status = 400;
      throw e;
    }
    return prisma.$transaction(async (tx) => {
      const provider = await tx.provider.update({
        where: { id: providerId },
        data: { balance: { increment: amount } },
      });
      await tx.transaction.create({ data: { providerId, type: "topup", amount, comment } });
      return provider;
    });
  },

  // Выдать/продлить Pro на N месяцев. Если у мастера уже активен Pro —
  // продлеваем от tierUntil, а не от текущей даты, иначе при продлении
  // сгорит остаток срока. monthlyPrice = 0 (ручная выдача админом, либо
  // текущий этап без цен) — просто выдаёт Pro без списания.
  activatePro: async (providerId: number, months: number) => {
    if (!Number.isInteger(months) || months <= 0) {
      const e: any = new Error("Количество месяцев должно быть положительным целым числом");
      e.status = 400;
      throw e;
    }
    return prisma.$transaction(async (tx) => {
      const provider = await tx.provider.findUnique({ where: { id: providerId } });
      if (!provider) {
        const e: any = new Error("Мастер не найден");
        e.status = 404;
        throw e;
      }

      const price = PRICING.pro.monthlyPrice;
      if (price > 0) {
        const updated = await tx.provider.updateMany({
          where: { id: providerId, balance: { gte: price } },
          data: { balance: { decrement: price } },
        });
        if (updated.count === 0) {
          const e: any = new Error("Недостаточно средств на балансе");
          e.status = 400;
          throw e;
        }
        await tx.transaction.create({
          data: { providerId, type: "subscription", amount: -price, comment: `Подписка Pro на ${months} мес.` },
        });
      }

      const extendFrom = getEffectiveTier(provider) === "pro" && provider.tierUntil ? provider.tierUntil : new Date();
      const tierUntil = new Date(extendFrom);
      tierUntil.setMonth(tierUntil.getMonth() + months);

      return tx.provider.update({ where: { id: providerId }, data: { tier: "pro", tierUntil } });
    });
  },

  // Перевести в free всех, у кого срок Pro истёк. Не обязательно запускать
  // по расписанию — getEffectiveTier уже считает тариф на лету, — но
  // полезно для чистоты данных и корректной аналитики (распределение free/pro).
  expireOverdue: async () => {
    const result = await prisma.provider.updateMany({
      where: { tier: "pro", tierUntil: { lt: new Date() } },
      data: { tier: "free" },
    });
    return result.count;
  },

  // Тариф, дата окончания, баланс и история последних операций — для экрана
  // мастера «Мой тариф» (когда он появится) и для проверки в этой задаче.
  getStatus: async (providerId: number) => {
    const provider = await prisma.provider.findUnique({ where: { id: providerId } });
    if (!provider) {
      const e: any = new Error("Мастер не найден");
      e.status = 404;
      throw e;
    }
    const transactions = await prisma.transaction.findMany({
      where: { providerId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return {
      tier: getEffectiveTier(provider),
      tierUntil: provider.tierUntil,
      balance: provider.balance,
      transactions,
    };
  },

  getStatusByTelegramId: async (telegramId: string) => {
    const provider = await prisma.provider.findFirst({ where: { user: { telegramId } } });
    if (!provider) {
      const e: any = new Error("Мастер не найден");
      e.status = 404;
      throw e;
    }
    return subscriptionsService.getStatus(provider.id);
  },
};
