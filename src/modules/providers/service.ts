import { prisma } from "../../db/prisma";

export const providersService = {
  // Публичный список — только не заблокированные, для отображения в Mini App
  list: () =>
    prisma.provider.findMany({
      where: { blocked: false },
      include: { user: true, services: { include: { service: true } }, areas: true },
      orderBy: { rating: "desc" },
    }),

  listAllForAdmin: () =>
    prisma.provider.findMany({
      include: { user: true, services: { include: { service: true } }, areas: true },
      orderBy: { id: "desc" },
    }),

  get: (id: number) =>
    prisma.provider.findUnique({
      where: { id },
      include: {
        user: true,
        services: { include: { service: true } },
        areas: true,
        reviews: true,
      },
    }),

  // Ручное добавление мастера из админки (документ явно рекомендует так стартовать)
  create: async (data: {
    telegramId: string;
    name: string;
    username?: string;
    description?: string;
    priceFrom?: number;
    serviceIds: number[];
    areas: string[];
  }) => {
    const user = await prisma.user.upsert({
      where: { telegramId: data.telegramId },
      update: { name: data.name, username: data.username, role: "provider" },
      create: {
        telegramId: data.telegramId,
        name: data.name,
        username: data.username,
        role: "provider",
      },
    });

    return prisma.provider.create({
      data: {
        userId: user.id,
        description: data.description,
        priceFrom: data.priceFrom,
        services: { create: data.serviceIds.map((serviceId) => ({ serviceId })) },
        areas: { create: data.areas.map((area) => ({ area })) },
      },
      include: { user: true, services: true, areas: true },
    });
  },

  update: (
    id: number,
    data: Partial<{
      description: string;
      priceFrom: number;
      verified: boolean;
      blocked: boolean;
      responseTimeMin: number;
    }>
  ) => prisma.provider.update({ where: { id }, data }),

  remove: (id: number) => prisma.provider.delete({ where: { id } }),
};
