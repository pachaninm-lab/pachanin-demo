# Open Source / License Audit — platform-v7

Дата: 2026-06-15. Цель: оценить лицензионные риски зависимостей. Полный
автоматический скан (`pnpm licenses` / FOSSA / Snyk) — owner-side: в sandbox
команда недоступна; ниже — инвентаризация по манифестам и рекомендации.

## 1. Поверхность runtime-зависимостей (apps/web)

Основные (версии на 2026-06-15) и типичные лицензии экосистемы:
- `next@^14.2.35` — MIT.
- `react@18.3.1`, `react-dom@18.3.1` — MIT.
- `@radix-ui/*` — MIT.
- `@tanstack/react-query@^5.99`, `@tanstack/react-table@^8.21` — MIT.
- `react-hook-form@^7.72` — MIT; `zod@^4.3` — MIT.
- `zustand@^5.0` — MIT; `sonner@^2.0` — MIT.
- `recharts@^3.8` — MIT (транзитивно `socket.io-parser`).
- `socket.io-client@^4.8` — MIT.
- Шрифт Inter — SIL Open Font License (OFL).

Dev/build (не поставляются в runtime): `vitest`, `@playwright/test`,
`typescript`, `msw` — MIT/Apache-2.0.

## 2. Находки

### OSS-001 — Нет автоматического license-scan в CI
- **Severity:** MEDIUM. **Risk:** копилефт/несовместимая лицензия может прийти
  транзитивно незамеченной. **Fix:** добавить CI-шаг `pnpm licenses list` или
  `license-checker`/FOSSA с allowlist (MIT/Apache-2.0/ISC/BSD/OFL) и fail на
  GPL/AGPL/copyleft в runtime-ветке. **Status:** owner-side/CI-PR.

### OSS-002 — Нет сгенерированного SBOM-артефакта
- **Severity:** LOW. **Fix:** CycloneDX/SPDX на релиз (см.
  `../audit/SBOM_READINESS.md`). **Status:** owner-side/CI-PR.

### OSS-003 — Dependabot-алерты
- **Severity:** MEDIUM. ~70 исторически (1 critical, 26 high); critical-путь
  Next.js закрыт апгрейдом 14.2.35; остаток преимущественно транзитивный
  (socket.io-стек). **Fix:** прогон Dependabot/`pnpm audit`, обновление в
  отдельном deps-PR. Активен gate `dependency-review.yml` (fail-on critical).
  **Status:** monitored.

## 3. Copyleft / совместимость
По манифестам прямых зависимостей — преимущественно permissive (MIT/Apache/ISC/
BSD/OFL); очевидных GPL/AGPL в прямых runtime-зависимостях не выявлено.
Подтверждение по транзитивному графу — через автоматический скан (OSS-001).

## Чеклист (owner-side, перед продажей)
- [ ] Прогнать license-scan по `pnpm-lock.yaml` (runtime отдельно от dev).
- [ ] Зафиксировать allowlist лицензий и политику.
- [ ] Приложить SBOM (CycloneDX/SPDX) к DD-пакету.
- [ ] Закрыть/принять остаточные Dependabot-алерты с обоснованием.

## Вердикт (OSS/License)
Стек permissive-ориентированный, явных копилефт-рисков в прямых зависимостях нет.
Формальная сертификация лицензий и SBOM — owner-side (CI-инструменты), не блокер
для controlled-pilot, но обязательны к передаче покупателю.
