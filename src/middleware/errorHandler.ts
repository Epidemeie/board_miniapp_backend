import { Request, Response, NextFunction } from "express";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || "Внутренняя ошибка сервера" });
}
