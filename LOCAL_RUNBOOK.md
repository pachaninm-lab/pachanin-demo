# Локальный запуск платформы (без Docker)

Проверено 16.07.2026 в среде разработки (Node 22, PostgreSQL 16, pnpm 10).
Цель: живой контур web → API → PostgreSQL для работы над каноническим сценарием
(`CANONICAL_SCENARIO.md`).

## 1. PostgreSQL

Docker-демон не обязателен — достаточно локального PostgreSQL 16:

```bash
# от root: создать непривилегированного пользователя и кластер
useradd -m pguser
PGDATA=/var/lib/pg-local
mkdir -p "$PGDATA" && chown -R pguser "$PGDATA" && chmod 700 "$PGDATA"
su pguser -s /bin/bash -c "/usr/lib/postgresql/16/bin/initdb -D '$PGDATA' -U postgres --auth=trust -E UTF8"
su pguser -s /bin/bash -c "/usr/lib/postgresql/16/bin/pg_ctl -D '$PGDATA' -l '$PGDATA/log' -o '-p 5433 -k /tmp -c listen_addresses=127.0.0.1' start"
psql -h 127.0.0.1 -p 5433 -U postgres -c "CREATE DATABASE pc_local;"
```

## 2. API (@pc/api)

```bash
pnpm install --filter @pc/api...
cd apps/api
export DATABASE_URL='postgresql://postgres@127.0.0.1:5433/pc_local'
export AUTH_DATABASE_URL='postgresql://postgres@127.0.0.1:5433/pc_local'
export JWT_SECRET='local-audit-secret-0123456789abcdef'   # >= 32 символов
export PORT=4000 NODE_ENV=development
pnpm exec prisma generate && pnpm exec prisma migrate deploy
pnpm build            # prisma generate + tsc
node dist/apps/api/src/main.js
```

Проверка: `curl http://127.0.0.1:4000/health` → `{"status":"ok"}`.

Примечания:
- `prisma db seed` не работает: `apps/api/package.json` ссылается на несуществующий
  `prisma/seed.ts` (кандидат на чистку). Реальный сид выполняется сервисом
  `DatabaseSeedService` при старте приложения.
- Предупреждения про Elasticsearch безвредны (поиск опционален).
- Известная ошибка сида: `shipment deal has no tenant authority` — сид отгрузок
  падает на tenant-констрейнте; сделки/документы сеются. Разбор — в фазе 1.

## 3. Web (@pc/web)

```bash
cd apps/web
JWT_SECRET='local-audit-secret-0123456789abcdef' \
NEXT_PUBLIC_API_URL='http://localhost:4000/api' \
pnpm dev
```

`JWT_SECRET` у web и API должен совпадать: web-роут логина выставляет cookie
кабинета `pc_v7_cabinet`, а layout проверяет её подпись этим секретом.

## 4. Тестовые пользователи

Регистрация через API (пароль должен проходить strong-password валидацию):

```bash
curl -X POST http://127.0.0.1:4000/api/auth/register -H 'Content-Type: application/json' -d '{
  "email":"buyer.test@procent-agro.test","password":"LocalTest#2026!",
  "fullName":"Тестовый покупатель","role":"BUYER",
  "orgLegalName":"ООО АгроТрейд Тест","orgInn":"7701234567","orgType":"LEGAL"}'
```

Роли API: `BUYER`, `FARMER` (продавец), `LOGISTICIAN`, `DRIVER`, `ELEVATOR`,
`LAB`, `SURVEYOR`, `BANK`, `ARBITRATOR`, `SUPPORT_MANAGER`, `EXECUTIVE` и др.
(маппинг на кабинеты — `apps/web/lib/platform-v7/verified-session.ts`).

Организация создаётся в статусе `PENDING` — логин отвечает 403
`ORGANIZATION_NOT_VERIFIED`. Локально подтверждаем напрямую в базе
(в продукте это делает оператор):

```bash
psql -h 127.0.0.1 -p 5433 -U postgres -d pc_local \
  -c "update organizations set status='VERIFIED', \"kycStatus\"='APPROVED', \"verifiedAt\"=now() where status='PENDING';"
```

После этого форма `/platform-v7/login` пускает в кабинет роли; кабинет читает
живые данные через `/api/proxy/*` и показывает честное пустое состояние,
если сделок нет.

## 5. Проверенный маршрут

register → verify org (SQL) → login через браузерную форму → редирект в
`/platform-v7/buyer` → кабинет с сервера: «Сегодня нет активных сделок»
(без экрана ошибки, без статичных демо-данных).
