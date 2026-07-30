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

  // Фронтенд проверяет этим, зарегистрирован ли открывший Mini App как мастер
  getByTelegramId: (telegramId: string) =>
    prisma.provider.findFirst({
      where: { user: { telegramId } },
      include: { user: true, services: { include: { service: true } }, areas: true },
    }),

  // Детальная карточка для админки: статистика и полная история откликов/отзывов
  getAdminDetail: (id: number) =>
    prisma.provider.findUnique({
      where: { id },
      include: {
        user: true,
        services: { include: { service: { include: { category: true } } } },
        areas: true,
        offers: {
          include: { request: { include: { service: true, user: true } } },
          orderBy: { id: "desc" },
        },
        reviews: {
          include: { user: true },
          orderBy: { id: "desc" },
        },
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
      name: string;
      username: string;
      description: string;
      priceFrom: number;
      verified: boolean;
      blocked: boolean;
      responseTimeMin: number;
      serviceIds: number[];
      areas: string[];
    }>
  ) => {
    const { name, username, serviceIds, areas, ...providerData } = data;
    return prisma.$transaction(async (tx) => {
      if (name !== undefined || username !== undefined) {
        const provider = await tx.provider.findUniqueOrThrow({ where: { id } });
        await tx.user.update({
          where: { id: provider.userId },
          data: { ...(name !== undefined && { name }), ...(username !== undefined && { username }) },
        });
      }
      if (serviceIds) {
        await tx.providerService.deleteMany({ where: { providerId: id } });
        await tx.providerService.createMany({ data: serviceIds.map((serviceId) => ({ providerId: id, serviceId })) });
      }
      if (areas) {
        await tx.providerArea.deleteMany({ where: { providerId: id } });
        await tx.providerArea.createMany({ data: areas.map((area) => ({ providerId: id, area })) });
      }
      return tx.provider.update({
        where: { id },
        data: providerData,
        include: { user: true, services: { include: { service: true } }, areas: true },
      });
    });
  },

  // Каскад в схеме чистит услуги/районы/отклики/отзывы мастера,
  // но пользователь остаётся — возвращаем ему роль клиента
  remove: async (id: number) => {
    const provider = await prisma.provider.delete({ where: { id } });
    await prisma.user.update({ where: { id: provider.userId }, data: { role: "client" } }).catch(() => {});
    return provider;
  },
};
