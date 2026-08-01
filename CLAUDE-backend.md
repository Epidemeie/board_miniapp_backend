# Tbilisi Services — Backend

Backend локального маркетплейса услуг для Тбилиси (Telegram Mini App).
MVP-стадия: проверяем спрос на реальных пользователях, набранных через
локальные Telegram/Facebook-группы.

## Стек

- Node.js + TypeScript + Express
- PostgreSQL через Prisma ORM
- Деплой: Docker (см. `Dockerfile`) через Coolify, self-hosted на VPS
- Без фреймворков для админки — обычный HTML/CSS/JS в `public/admin`

## Архитектура — строго модульная

```
src/modules/<name>/
  router.ts   — маршруты (публичные + admin-роутер отдельно)
  service.ts  — запросы к БД через Prisma
```

Модули: `categories`, `services`, `providers`, `requests`, `offers`,
`reviews`, `auth` (Telegram initData), `admin` (аналитика).

Исключение — `src/bot/bot.ts`: Telegram-бот на Telegraf, канал уведомлений
(заявки/отклики/заказы), без переписки — все ответы короткие и ведут в
Mini App кнопкой (`MINI_APP_URL`). Не HTTP-модуль (нет router.ts/service.ts,
не монтируется в `app.ts`), запускается отдельно в `src/index.ts` через
`startBot()`. Без `TELEGRAM_BOT_TOKEN` просто не стартует (WARN в логах),
остальной backend продолжает работать.

Правило: **новая функциональность = новый модуль** той же структуры.
Не сваливать логику в `app.ts` — там только подключение роутеров.
Публичные роуты монтируются на `/api/<module>`, админские — на
`/api/admin/<module>` и защищены `adminAuth` (Basic Auth,
логин/пароль из env `ADMIN_USERNAME` / `ADMIN_PASSWORD`).

## Модель данных

`prisma/schema.prisma` — источник истины по структуре БД. Ключевые сущности:
`User` (роль client/provider/admin, привязан к `telegramId`, свои
`rating`/`reviewCount`), `Provider` (рейтинг, цена, район, услуги —
many-to-many через `ProviderService` / `ProviderArea`), `Category` →
`Service`, `Request` (заявка клиента), `Offer` (отклик мастера на
заявку), `Review` (отзыв клиента о мастере), `ClientReview` (зеркало
`Review` в обратную сторону — отзыв мастера о клиенте).

Алгоритм подбора мастеров — `src/modules/requests/matching.ts`, веса:
услуга 30% / расстояние 20% / цена 15% / рейтинг 15% / отзывы 10% /
скорость 10%. Не менять веса без явного запроса — они зафиксированы
по исходному продуктовому документу.

## Роли пользователей (важно)

Приложение различает клиента и мастера **на фронтенде**, не здесь — но
backend даёт для этого отдельные публичные точки входа:
- `POST /api/providers/register` — самостоятельная регистрация мастера
  из Mini App (без админки), без подтверждения (`verified: false` по
  умолчанию, админ подтверждает вручную позже).
- `GET /api/providers/by-telegram/:telegramId` — фронтенд проверяет,
  зарегистрирован ли уже открывший приложение как мастер.
- `GET /api/requests/open?serviceId=` — лента открытых заявок для мастера
  (мастер может оказывать несколько услуг — `serviceId` принимает список
  через запятую).
- `GET /api/requests/mine?telegramId=` — заявки клиента + отклики по ним.

## Удаление мастера/клиента (админка)

`DELETE /api/admin/providers/:id` и `DELETE /api/admin/users/:id` удаляют
каскадом всё связанное — услуги/районы мастера, его отклики и отзывы (в
обе стороны — `Review` и `ClientReview`); у клиента — его заявки и
отзывы в обе стороны (`onDelete: Cascade` в `schema.prisma`, модели
`Provider`, `ProviderService`, `ProviderArea`, `Offer`, `Request`,
`Review`, `ClientReview`). Удаление мастера не удаляет его `User` —
роль откатывается на `client`, чтобы человек мог зарегистрироваться
заново.

## Рейтинг клиента (симметрично рейтингу мастера)

Как и мастер, клиент имеет `rating`/`reviewCount` на `User`, посчитанные
по отзывам от другой стороны — только в обратную сторону: мастер
оставляет отзыв о клиенте после завершения заказа. Модуль
`src/modules/clientReviews` — зеркало `src/modules/reviews`:
- `POST /api/client-reviews` — мастер оставляет отзыв о клиенте
  (`providerId`, `requestId`, `userId` клиента, `rating`, `text?`).
  В отличие от `reviewsService.create` (которому нужен upsert по
  `telegramId`, т.к. это может быть первый визит клиента), здесь upsert
  не нужен — и `Provider`, и `User` к этому моменту уже точно
  существуют. Пересчитывает `User.rating`/`reviewCount` в той же
  транзакции.
- `GET /api/users/by-telegram/:telegramId` / `GET /api/users/:id` —
  публичный профиль клиента (рейтинг + отзывы от мастеров), симметрично
  `providersRouter`'s `by-telegram`/`:id`. Отдельно от `usersAdminRouter`
  (закрыт `adminAuth`, для полной карточки клиента в админке).
- `GET /api/admin/client-reviews`, `DELETE /api/admin/client-reviews/:id`
  — модерация, зеркало `reviewsAdminRouter`.

Заказ считается завершённым по `Request.status === "completed"` (ставит
клиент через `POST /api/reviews`, см. `reviewsService.create`) — это
единственное условие, открывающее мастеру возможность оставить отзыв о
клиенте; отдельного «мастер подтвердил завершение» шага нет.

## Известные грабли (уже наступили и исправлены — не повторять)

1. **Alpine + Prisma требует OpenSSL явно.** `node:22-alpine` не
   содержит OpenSSL из коробки — движок Prisma падает с невнятной
   ошибкой парсинга JSON. Решение уже в `Dockerfile`:
   `RUN apk add --no-cache openssl libssl3` в обоих стейджах сборки, +
   `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]` в
   `schema.prisma`. Не убирать.
2. **Миграций не существует, используем `prisma db push`.** Файлы
   миграций (`prisma/migrations/`) никогда не генерировались через
   `prisma migrate dev` — только `schema.prisma` руками. Поэтому
   `Dockerfile` запускает `prisma db push --accept-data-loss`, а не
   `migrate deploy` (которая ничего не создаст без файлов миграций).
   Если в будущем перейдём на нормальные миграции — нужно сначала
   сгенерировать историю миграций из текущей живой БД, иначе
   `db push` при следующем деплое может расхождение схемы бесшумно
   исправить не так, как ожидается.
3. **`DATABASE_URL` в Coolify — поле "Postgres URL (internal)"** на
   карточке PostgreSQL-ресурса, работает только для связи между
   контейнерами внутри одного сервера Coolify (не наружу).

## Деплой

- Сервер: VPS (Hetzner-класса), Ubuntu 24.04, управляется через Coolify.
- Домен backend: `api.goservices.lol` (фронтенд — `goservices.lol`,
  отдельный ресурс/репозиторий).
- Build Pack в Coolify: `Dockerfile`.
- env переменные задаются в Coolify (Environment Variables), не в `.env`
  на проде — `.env` только для локальной разработки, см. `.env.example`.
- После пуша в `main` деплой в Coolify запускается вручную кнопкой
  Deploy (автодеплой по пушу не настроен).

## Локальный запуск

```bash
npm install
cp .env.example .env   # заполнить DATABASE_URL локальной/тестовой БД
npx prisma db push
npm run seed            # начальные категории: Ремонт/Уборка/Перевозки
npm run dev
```

Админка: `http://localhost:3000/admin`.

## Связанный репозиторий

Фронтенд (React + Vite, Telegram Mini App) — отдельный репозиторий
`board_miniapp`, деплоится отдельным ресурсом в том же проекте Coolify.
Обращается к этому backend по `https://api.goservices.lol/api`.
При изменении публичных эндпоинтов здесь — проверять, не сломался ли
контракт с фронтендом (особенно формы запросов `POST /requests`,
`POST /providers/register`, `POST /offers`).

## Правила при работе над этим репо

- Не переписывать модульную структуру ради «универсальности» — простота
  и явные модули важнее.
- Не добавлять фреймворки/библиотеки без необходимости (проект
  сознательно минималистичный на MVP-стадии).
- Все пользовательские тексты (ошибки, лейблы) — на русском, это
  продукт для русскоязычных пользователей в Тбилиси.
- Перед изменением `Dockerfile` или `schema.prisma` — перечитать раздел
  «Известные грабли» выше.
