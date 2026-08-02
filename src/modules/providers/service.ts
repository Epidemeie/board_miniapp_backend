import { prisma } from "../../db/prisma";

// Проверка перед самостоятельной регистрацией (POST /providers/register) —
// заблокированный клиент не должен обходить блокировку, просто заведя
// профиль мастера. Ручное добавление мастера из админки (POST /admin/providers,
// тот же providersService.create) эту проверку сознательно не проходит —
// админ добавляет мастера сам, ему видно, кого он добавляет.
export async function assertNotBlocked(telegramId: string) {
  const user = await prisma.user.findUnique({ where: { telegramId } });
  if (user?.blocked) {
    const e: any = new Error("Ваш аккаунт заблокирован администратором");
    e.status = 403;
    throw e;
  }
}

export const providersService = {
  // Публичный список — только не заблокированные и не деактивированные
  // самим мастером, для отображения в Mini App
  list: () =>
    prisma.provider.findMany({
      where: { blocked: false, active: true },
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
        reviews: { include: { user: true }, orderBy: { id: "desc" } },
      },
    }),

  // Фронтенд проверяет этим, зарегистрирован ли открывший Mini App как
  // мастер. active: true — деактивированный (см. deactivate) мастер для
  // этой проверки как будто не зарегистрирован; реактивация происходит в
  // usersService.setPrefs при повторном выборе роли «мастер», не здесь
  // (GET не должен иметь побочных эффектов).
  getByTelegramId: (telegramId: string) =>
    prisma.provider.findFirst({
      where: { user: { telegramId }, active: true },
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
      active: boolean;
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

  // Мастер нажал «Удалить аккаунт» — мягкое удаление (см. remove() выше для
  // настоящего, только из админки): анкета, услуги, районы, рейтинг и
  // отзывы остаются в базе, но профиль пропадает из публичного списка и
  // подбора (list/matchCandidates). telegramId в теле запроса — проверка,
  // что деактивирует именно владелец профиля, как в requestsService.archive.
  deactivate: async (id: number, telegramId: string) => {
    const provider = await prisma.provider.findUnique({ where: { id }, include: { user: true } });
    if (!provider) {
      const e: any = new Error("Мастер не найден");
      e.status = 404;
      throw e;
    }
    if (provider.user.telegramId !== telegramId) {
      const e: any = new Error("Нет доступа к этому профилю");
      e.status = 403;
      throw e;
    }
    const updated = await prisma.provider.update({ where: { id }, data: { active: false } });
    // Сбрасываем entryRole, чтобы при следующем открытии показался экран
    // выбора роли, а не автовход в уже «удалённый» кабинет мастера.
    await prisma.user.update({ where: { id: provider.userId }, data: { entryRole: null } });
    return updated;
  },

  // Настройки уведомлений мастера — сам себе, из личного кабинета (не через
  // админку). telegramId в теле запроса — та же проверка владения профилем,
  // что и в deactivate выше.
  updatePrefs: async (
    id: number,
    telegramId: string,
    data: Partial<{ notifyRequests: boolean; notifyReviews: boolean; notifyOrders: boolean; notifyChat: boolean }>
  ) => {
    const provider = await prisma.provider.findUnique({ where: { id }, include: { user: true } });
    if (!provider) {
      const e: any = new Error("Мастер не найден");
      e.status = 404;
      throw e;
    }
    if (provider.user.telegramId !== telegramId) {
      const e: any = new Error("Нет доступа к этому профилю");
      e.status = 403;
      throw e;
    }
    return prisma.provider.update({ where: { id }, data });
  },
};
