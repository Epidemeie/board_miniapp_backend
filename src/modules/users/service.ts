import { prisma } from "../../db/prisma";

export const usersService = {
  // Экраны language/role показываются только один раз — дальше берём
  // сохранённый выбор по telegramId (работает и для клиента, и для мастера,
  // это один и тот же User). entryRole — отдельное от `role` поле: `role`
  // отражает фактическую регистрацию мастера и им управляет backend
  // (providersService), а entryRole — это именно предпочтение входа,
  // которое пользователь может поменять в настройках в любой момент.
  getPrefs: async (telegramId: string) => {
    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: { language: true, entryRole: true, notifyOrders: true, notifyReviews: true, notifyChat: true },
    });
    return {
      language: user?.language ?? null,
      entryRole: user?.entryRole ?? null,
      notifyOrders: user?.notifyOrders ?? true,
      notifyReviews: user?.notifyReviews ?? true,
      notifyChat: user?.notifyChat ?? true,
    };
  },

  // Выбор роли (entryRole) на экране role или в настройках — это и есть
  // момент, когда пользователь «возвращается» в приложение: если до этого
  // он деактивировал профиль кнопкой «Удалить аккаунт», здесь он тихо
  // реактивируется (active: true), без отдельной кнопки «восстановить».
  // Для роли provider заодно реактивируем и связанный Provider — иначе
  // мастер выбрал бы «Я мастер», но его карточка так и осталась бы скрыта.
  setPrefs: async (data: {
    telegramId: string;
    name: string;
    username?: string;
    language?: string;
    entryRole?: string;
    notifyOrders?: boolean;
    notifyReviews?: boolean;
    notifyChat?: boolean;
  }) => {
    const { telegramId, name, username, language, entryRole, notifyOrders, notifyReviews, notifyChat } = data;
    const user = await prisma.user.upsert({
      where: { telegramId },
      update: {
        ...(language !== undefined && { language }),
        ...(entryRole !== undefined && { entryRole, active: true }),
        ...(notifyOrders !== undefined && { notifyOrders }),
        ...(notifyReviews !== undefined && { notifyReviews }),
        ...(notifyChat !== undefined && { notifyChat }),
      },
      create: {
        telegramId,
        name,
        username,
        ...(language !== undefined && { language }),
        ...(entryRole !== undefined && { entryRole }),
        ...(notifyOrders !== undefined && { notifyOrders }),
        ...(notifyReviews !== undefined && { notifyReviews }),
        ...(notifyChat !== undefined && { notifyChat }),
      },
    });
    if (entryRole === "provider") {
      await prisma.provider.updateMany({ where: { userId: user.id }, data: { active: true } });
    }
    return user;
  },

  // Клиент нажал «Удалить аккаунт» — профиль и рейтинг остаются в базе
  // (иначе перерегистрация с тем же telegramId обнулила бы историю), но
  // скрываются из выдачи (см. requestsService.listOpen). entryRole сбрасываем
  // в null, чтобы при следующем открытии показался экран выбора роли, а не
  // автовход в уже «удалённый» кабинет — см. useEffect в начале App.jsx.
  deactivate: (telegramId: string) => prisma.user.update({ where: { telegramId }, data: { active: false, entryRole: null } }),

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

  // Все пользователи для админки (вкладка «Пользователи») — не только role:
  // "client", а вообще все User, т.к. один и тот же человек может быть и
  // клиентом, и мастером (Provider — отдельная связанная запись). provider
  // тут нужен и для бейджа «Мастер» в списке, и для фильтров по
  // услугам/районам мастера, поэтому включаем сразу его services/areas —
  // без этого пришлось бы делать отдельный запрос на каждую строку.
  list: async () => {
    const users = await prisma.user.findMany({
      orderBy: { id: "desc" },
      include: {
        _count: { select: { requests: true, reviews: true, clientReviews: true } },
        provider: { include: { services: { include: { service: true } }, areas: true } },
      },
    });
    return users;
  },

  // Детальная карточка пользователя — объединённая: клиентская история
  // (заявки, отзывы) + карточка мастера целиком (услуги/районы/отклики/
  // отзывы о нём), если у этого User есть связанный Provider. Одним
  // запросом, чтобы фронту не нужно было отдельно дёргать /admin/providers/:id
  // для той же самой карточки в другой вкладке.
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
        provider: {
          include: {
            services: { include: { service: { include: { category: true } } } },
            areas: true,
            offers: {
              include: { request: { include: { service: true, user: true } } },
              orderBy: { id: "desc" },
            },
            reviews: { include: { user: true }, orderBy: { id: "desc" } },
          },
        },
      },
    }),

  update: (id: number, data: { name?: string; username?: string; blocked?: boolean }) =>
    prisma.user.update({ where: { id }, data }),

  remove: (id: number) => prisma.user.delete({ where: { id } }),
};
