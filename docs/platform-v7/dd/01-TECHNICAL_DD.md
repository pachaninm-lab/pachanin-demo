# Technical Due Diligence — platform-v7 / «Прозрачная Цена»

Дата: 2026-06-15. Зрелость: controlled-pilot / pre-integration / adapter-ready.
Метод: статическая инвентаризация кода + проверка CI/live-smoke. Связанные
документы: `../audit/AUDIT_REPORT.md` и доменные отчёты.

## 1. Архитектура и стек

- **Монорепо** (pnpm@10.2.1): `apps/web` (Next.js 14 App Router, React 18.3,
  TypeScript), `apps/api` (Prisma 5.22 / Postgres-ready), `apps/landing`,
  `packages/domain-core` (чистая доменная логика).
- **Слои platform-v7:** UI (`app/platform-v7/**`, `components/platform-v7/**`,
  `components/v7r/**`) → application-service/boundaries
  (`lib/platform-v7/server-*`, `action-boundary`) → доменное ядро
  (`packages/domain-core/src/execution-simulation/**`) → порты персистентности
  (`runtime/persistence-ports.ts`) и внешних адаптеров (`external-adapters.ts`).
- **Разделение чистое:** доменное ядро не зависит от React/Next; деньги/
  состояние сделки/споры — в `execution-simulation`. Это даёт тестируемость и
  заменяемость хранилища/интеграций без переписывания UI.

## 2. Качество кода

- TypeScript strict; именование консистентное (`platformV7*`, `P7*`).
- Низкая связанность UI↔домен через application-service.
- **TECH-001 (MEDIUM):** `next.config.mjs` отключает build-gates
  (`typescript.ignoreBuildErrors`, `eslint.ignoreDuringBuilds`). Смягчение:
  отдельные `ci`/`tsc` и `web-unit` gate-ы зелёные на каждом PR. Рекомендация:
  сузить/снять подавление.
- **TECH-002 (MEDIUM):** дубль `next.config.js` и `next.config.mjs` с разными
  `redirects()` — латентный риск расхождения хостингов (см. Integration/Hosting).
- `dangerouslySetInnerHTML` (43 файла) — только статический CSS, без user-data
  (см. Cybersecurity DD).

## 3. Тесты и CI

- **Полный web-unit-набор зелёный** (585 файлов / 3702 теста на 2026-06-15),
  vitest + happy-dom + @testing-library/react.
- Required-гейты на каждом PR: `ci` (tsc), `build`, `web-unit`,
  `autopilot-guard` (scope-guard + typecheck + tests), `CodeQL`,
  `dependency-review`.
- Доменное ядро покрыто unit + сквозными runtime-сценариями
  (`platformV7UnifiedDealLifecycle`, offline/duplicate/conflict/retry).
- **TECH-003 (LOW):** браузерные e2e (Playwright) как hard-CI — owner-side
  (нужна CI-инфраструктура браузеров); сейчас сквозной контур покрыт на
  runtime-уровне в web-unit + live route-smoke (Netlify).

## 4. Данные и состояние

- Порты `P7RuntimeUnitOfWork` (8 репозиториев + idempotency + audit +
  runInTransaction); реализации: in-memory/mock и `createP7DbRuntimeStore`
  поверх `P7PersistenceDriver`. **Реальная БД = реализация драйвера**, без правок
  application-service.
- **TECH-004 (MEDIUM):** durable-persistence нет (in-memory) — owner-side
  (реальная БД + миграции; Prisma в `apps/api` как основа).

## 5. Масштабируемость / эксплуатация

- Stateless Next-приложение; деньги/идемпотентность спроектированы под внешнюю БД.
- Observability: health-cockpit (System/Deal/Money/Integration/Adapter/Queue),
  pilot-metrics, incident journal. SLA-дашборд (uptime/latency) — owner-side.
- Hosting: Netlify активен (hard-gate smoke зелёный), Vercel заблокирован на
  уровне аккаунта (HTTP 402) — см. `dual-hosting-operating-rules.md`.

## Вердикт (Technical)
Архитектура зрелая для controlled-pilot: чистое доменное ядро, порты под БД и
интеграции, сильный CI. Технический долг управляем (TECH-001/002 — config,
TECH-004 — БД owner-side). Переписывание не требуется.
