import { prisma } from "../../db/prisma";

export const categoriesService = {
  list: () => prisma.category.findMany({ orderBy: { id: "asc" } }),

  create: (data: { name: string; icon?: string }) => prisma.category.create({ data }),

  update: (id: number, data: { name?: string; icon?: string }) =>
    prisma.category.update({ where: { id }, data }),

  remove: (id: number) => prisma.category.delete({ where: { id } }),
};
