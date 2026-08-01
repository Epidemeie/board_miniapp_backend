import { prisma } from "../../db/prisma";
import { scoreProvider } from "./matching";
import { recomputeProviderRating, recomputeUserRating } from "../../db/ratings";

export const requestsService = {
  // Клиент создаёт заявку — авторизуется по telegramId (см. модуль auth)
  create: async (data: {
    telegramId: string;
    name: string;
    username?: string;
    serviceId: number;
    description?: string;
    budget?: number;
    urgency?: string;
    area?: string;
  }) => {
    const user = await prisma.user.upsert({
      where: { telegramId: data.telegramId },
      update: { name: data.name, username: data.username },
      create: { telegramId: data.telegramId, name: data.name, username: data.username, role: "client" },
    });

    return prisma.request.create({
      data: {
        userId: user.id,
        serviceId: data.serviceId,
        description: data.description,
        budget: data.budget,
        urgency: data.urgency,
        area: data.area,
      },
    });
  },

  // Лента открытых заявок под услуги мастера (мастер может оказывать несколько услуг).
  // Архивные (удалённые клиентом) заявки сюда не попадают, как и заявки от
  // клиентов, деактивировавших аккаунт (user.active — см. usersService.deactivate).
  listOpen: (serviceIds: number[]) =>
    prisma.request.findMany({
      where: { serviceId: { in: serviceIds }, status: "open", archived: false, user: { active: true } },
      include: { user: true, service: true },
      orderBy: { id: "desc" },
    }),

  // Заявки клиента + отклики по ним — экран «Мои заявки»
  listMine: (telegramId: string) =>
    prisma.request.findMany({
      where: { user: { telegramId } },
      include: {
        service: true,
        offers: { include: { provider: { include: { user: true } } } },
      },
      orderBy: { id: "desc" },
    }),

  listForAdmin: () =>
    prisma.request.findMany({
      include: { user: true, service: { include: { category: true } }, offers: true },
      orderBy: { id: "desc" },
    }),

  get: (id: number) =>
    prisma.request.findUnique({
      where: { id },
      include: {
        user: true,
        service: true,
        offers: { include: { provider: { include: { user: true } } } },
      },
    }),

  // Подбор подходящих мастеров под заявку — тот самый алгоритм из документа
  matchCandidates: async (id: number, limit = 5) => {
    const request = await prisma.request.findUnique({ where: { id } });
    if (!request) return null;

    const candidates = await prisma.provider.findMany({
      where: { blocked: false, active: true, services: { some: { serviceId: request.serviceId } } },
      include: { user: true, areas: true, services: true },
    });

    return candidates
      .map((provider) => ({
        provider,
        ...scoreProvider(provider, { area: request.area, budget: request.budget }),
      }))
      .sort((a, b) => b.overall - a.overall)
      .slice(0, limit);
  },

  updateStatus: (id: number, status: string) => prisma.request.update({ where: { id }, data: { status } }),

  // Клиент «удаляет» свою заявку — только пока она открыта (мастер ещё не выбран).
  // Это не DELETE: запись остаётся в БД с archived=true и уходит в «Архив заявок»
  // на фронте и в админке, не участвует в статистике/ленте мастеров.
  archive: async (id: number, telegramId: string) => {
    const request = await prisma.request.findUnique({ where: { id }, include: { user: true } });
    if (!request) {
      const e: any = new Error("Заявка не найдена");
      e.status = 404;
      throw e;
    }
    if (request.user.telegramId !== telegramId) {
      const e: any = new Error("Нет доступа к этой заявке");
      e.status = 403;
      throw e;
    }
    if (request.status !== "open") {
      const e: any = new Error("Можно удалить только заявку, к которой ещё не выбран мастер");
      e.status = 400;
      throw e;
    }
    return prisma.request.update({ where: { id }, data: { archived: true } });
  },

  // Админка: полное удаление заявки (каскадом — её отклики и отзывы в обе
  // стороны). Каскад в базе сам вычистит строки отзывов, но не пересчитает
  // рейтинги мастера/клиента, которых они касались — поэтому берём
  // затронутые providerId/userId до удаления и пересчитываем после.
  remove: async (id: number) => {
    const [reviews, clientReviews] = await Promise.all([
      prisma.review.findMany({ where: { requestId: id }, select: { providerId: true } }),
      prisma.clientReview.findMany({ where: { requestId: id }, select: { userId: true } }),
    ]);
    const deleted = await prisma.request.delete({ where: { id } });
    await Promise.all([
      ...reviews.map((r) => recomputeProviderRating(r.providerId)),
      ...clientReviews.map((r) => recomputeUserRating(r.userId)),
    ]);
    return deleted;
  },
};
