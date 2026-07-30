import { prisma } from "../../db/prisma";

export const usersService = {
  // Клиенты для админки — с количеством заявок/отзывов для превью в списке
  list: async () => {
    const users = await prisma.user.findMany({
      where: { role: "client" },
      orderBy: { id: "desc" },
      include: { _count: { select: { requests: true, reviews: true } } },
    });
    return users;
  },

  // Детальная карточка клиента: вся история заявок и отзывов
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
      },
    }),

  update: (id: number, data: { name?: string; username?: string }) =>
    prisma.user.update({ where: { id }, data }),

  remove: (id: number) => prisma.user.delete({ where: { id } }),
};
