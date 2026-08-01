import { prisma } from "../../db/prisma";

export const usersService = {
  // Экраны language/role показываются только один раз — дальше берём
  // сохранённый выбор по telegramId (работает и для клиента, и для мастера,
  // это один и тот же User). entryRole — отдельное от `role` поле: `role`
  // отражает фактическую регистрацию мастера и им управляет backend
  // (providersService), а entryRole — это именно предпочтение входа,
  // которое пользователь может поменять в настройках в любой момент.
  getPrefs: async (telegramId: string) => {
    const user = await prisma.user.findUnique({ where: { telegramId }, select: { language: true, entryRole: true } });
    return { language: user?.language ?? null, entryRole: user?.entryRole ?? null };
  },

  setPrefs: (data: { telegramId: string; name: string; username?: string; language?: string; entryRole?: string }) => {
    const { telegramId, name, username, language, entryRole } = data;
    return prisma.user.upsert({
      where: { telegramId },
      update: {
        ...(language !== undefined && { language }),
        ...(entryRole !== undefined && { entryRole }),
      },
      create: {
        telegramId,
        name,
        username,
        ...(language !== undefined && { language }),
        ...(entryRole !== undefined && { entryRole }),
      },
    });
  },

  // Публичный профиль клиента для Mini App — симметрично
  // providersService.getByTelegramId/get: лёгкая проверка по telegramId,
  // затем полная карточка с рейтингом и отзывами от мастеров.
  getPublicByTelegramId: (telegramId: string) =>
    prisma.user.findUnique({
      where: { telegramId },
      select: { id: true, name: true, username: true, rating: true, reviewCount: true },
    }),

  getPublicDetail: (id: number) =>
    prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        username: true,
        rating: true,
        reviewCount: true,
        clientReviews: {
          include: { provider: { include: { user: true } } },
          orderBy: { id: "desc" },
        },
      },
    }),

  // Клиенты для админки — с количеством заявок/отзывов для превью в списке
  list: async () => {
    const users = await prisma.user.findMany({
      where: { role: "client" },
      orderBy: { id: "desc" },
      include: { _count: { select: { requests: true, reviews: true, clientReviews: true } } },
    });
    return users;
  },

  // Детальная карточка клиента: вся история заявок, отзывов от клиента и о клиенте
  getDetail: (id: number) =>
    prisma.user.findUnique({
      where: { id },
      include: {
        requests: {
          include: {
            service: { include: { category: true } },
            offers: { include: { provider: { include: { user: true } } } },
          },
          orderBy: { id: "desc" },
        },
        reviews: {
          include: { provider: { include: { user: true } } },
          orderBy: { id: "desc" },
        },
        clientReviews: {
          include: { provider: { include: { user: true } } },
          orderBy: { id: "desc" },
        },
      },
    }),

  update: (id: number, data: { name?: string; username?: string }) =>
    prisma.user.update({ where: { id }, data }),

  remove: (id: number) => prisma.user.delete({ where: { id } }),
};
