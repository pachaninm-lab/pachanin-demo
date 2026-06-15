# SBOM_READINESS — platform-v7

Дата: 2026-06-15. SCA/SBOM readiness-чеклист. Полный CVE-скан и подписанный SBOM —
owner-side (нужен dependency graph live-стенда / CI-артефакт).

## Runtime-зависимости (apps/web/package.json)

Ключевая поверхность (версии на 2026-06-15):
- `next@^14.2.35` — фреймворк (critical middleware-bypass и WS-SSRF пропатчены в
  14.2.35).
- `react@18.3.1`, `react-dom@18.3.1` — LTS.
- `@radix-ui/*` (^1.1.x–^2.2.x) — UI-примитивы.
- `@tanstack/react-query@^5.99`, `@tanstack/react-table@^8.21` — данные/таблицы.
- `react-hook-form@^7.72`, `zod@^4.3` — формы/валидация.
- `zustand@^5.0` — стейт.
- `recharts@^3.8` — графики (транзитивно тянет `socket.io-parser`).
- `socket.io-client@^4.8` — realtime.
- `sonner@^2.0` — тосты.

Build/dev (не runtime): `vitest`, `@playwright/test`, `typescript`, `msw`.
Менеджер пакетов: `pnpm@10.2.1`.

## Security-critical зависимости (приоритет мониторинга)
1. `next` — auth/middleware/SSR-поверхность. Держать ≥ актуального патча.
2. `socket.io-client` + транзитивный `socket.io-parser` — сетевой парсинг.
3. `zod` — валидация входных данных (граница доверия).
4. `@tanstack/react-query` — сетевые запросы/кеш.

## Находки

### SCA-001 — Dependabot-алерты на default-branch
- **Severity:** MEDIUM. **Affected:** граф зависимостей репозитория. **Risk:**
  на момент push фиксировалось ~70 алертов (1 critical, 26 high) исторически;
  critical-путь Next.js уже закрыт апгрейдом 14.2.35. Остаток — преимущественно
  транзитивные. **Fix:** прогнать `pnpm audit`/Dependabot, поднять/заменить
  уязвимые транзитивы (в частности socket.io-стек), внести в lockfile отдельным
  deps-PR. **Test:** `dependency-review` gate (`.github/workflows/dependency-review.yml`,
  fail-on-severity: critical) + `pnpm audit` в CI. **Status:** monitored;
  правка lockfile вне scope autopilot ⇒ отдельный deps-PR (owner-side).

### SCA-002 — Нет генерируемого SBOM-артефакта
- **Severity:** LOW. **Fix:** добавить шаг CI генерации CycloneDX/SPDX
  (`@cyclonedx/cyclonedx-npm` или `syft`) с публикацией артефакта на каждый
  релиз. **Status:** owner-side/CI-PR.

## SBOM-чеклист (для передачи покупателю)
- [ ] Сгенерировать CycloneDX/SPDX по `pnpm-lock.yaml` (runtime + dev раздельно).
- [ ] Прогнать SCA (Dependabot/`pnpm audit`/Snyk) и приложить отчёт.
- [ ] Проверить лицензии (license-check) на запрещённые/копилефт.
- [ ] Зафиксировать security-critical компоненты (next, socket.io, zod).
- [ ] Настроить политику обновлений (critical/high — патч в N дней).
- [ ] Хранить подписанный SBOM с каждым релизом.

## Лицензии
Стек преимущественно MIT/Apache-2.0 (React, Next, Radix, TanStack, zod, zustand).
Формальный license-scan — owner-side (нужен инструмент в CI).
