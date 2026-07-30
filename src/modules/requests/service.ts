import { prisma } from "../../db/prisma";
import { scoreProvider } from "./matching";

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

  // Лента открытых заявок под услуги мастера (мастер может оказывать несколько услуг)
  listOpen: (serviceIds: number[]) =>
    prisma.request.findMany({
      where: { serviceId: { in: serviceIds }, status: "open" },
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
      where: { blocked: false, services: { some: { serviceId: request.serviceId } } },
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
};
