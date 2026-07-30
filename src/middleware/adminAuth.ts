import { Request, Response, NextFunction } from "express";

// Простая Basic Auth защита для админ-раздела API.
// Логин/пароль берутся из переменных окружения ADMIN_USERNAME / ADMIN_PASSWORD.
export function adminAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Basic ")) {
    res.set("WWW-Authenticate", 'Basic realm="Admin"');
    return res.status(401).json({ error: "Требуется авторизация" });
  }

  const base64 = header.split(" ")[1];
  const decoded = Buffer.from(base64, "base64").toString();
  const [user, pass] = decoded.split(":");

  if (user === process.env.ADMIN_USERNAME && pass === process.env.ADMIN_PASSWORD) {
    return next();
  }

  res.set("WWW-Authenticate", 'Basic realm="Admin"');
  return res.status(401).json({ error: "Неверный логин или пароль" });
}
