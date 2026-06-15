# Comprehensive Evidence-Based Audit — platform-v7 / «Прозрачная Цена»

Дата: 2026-06-15. Метод: статические сканы и метрики по реальному репозиторию
(не прогноз, а измеренные значения). Дополняет качественные отчёты в
`./` и `../dd/` твёрдыми цифрами. Зрелость: controlled-pilot / pre-integration.

## 1. Количественная инвентаризация (scope: platform-v7 + v7r + domain-core)

| Метрика | Значение |
|---------|----------|
| Модули `lib/platform-v7` (.ts, без тестов) | 284 |
| Компоненты `components/platform-v7` | 156 |
| Компоненты `components/v7r` | 61 |
| Маршруты `app/platform-v7` (page.tsx) | 181 |
| Доменное ядро `execution-simulation` (.ts) | 7 |
| LOC (scope, без тестов) | ~89 800 |
| Тест-файлы (unit/spec) | 667 |
| E2E-файлы | 76 |
| Тест-кейсы `it()/test()` (unit) | 3 413 |
| `data-testid` (стабильность QA/e2e) | 484 |
| Зависимости web | prod 26 / dev 20 |
| Зависимости api | prod 15 / dev 14 |

Вывод: крупная, но модульная и сильно покрытая тестами база (≈1 тест-файл на
0.6 модуля; 484 testid дают стабильные QA-хуки).

## 2. SAST / code-security (измерено по scope)

| Проверка | Результат | Оценка |
|----------|-----------|--------|
| `eval(` / `new Function(` | **0 / 0** | ✅ |
| raw `.innerHTML` | **0** | ✅ |
| `dangerouslySetInnerHTML` | 44 | ⚠️ только статический CSS `<style>` (проверено ранее), без user-data |
| `@ts-ignore`/`@ts-nocheck`/`ts-expect-error` | **0** | ✅ нет подавления типов в scope |
| `: any` / `as any` | 29 | ℹ️ LOW — точечные касты, не вокруг auth |
| `console.*` / `debugger` | **0 / 0** | ✅ чисто для прод |
| `http://` (не-TLS) | **0** | ✅ |
| `TODO/FIXME/HACK` | 2 | ✅ оба — легитимные integration-маркеры (real-adapter shells) |
| `Math.random(` | 2 | ✅ только в `DemoDealAutoplay` (demo id/latency), не для безопасности |
| `process.env` в scope | 9 (`NEXT_PUBLIC_DEV_MODE`, `NEXT_PUBLIC_PLATFORM_V*`) | ✅ только публичные |
| `'use client'` | 143 | ℹ️ доля клиентских компонентов высокая (UI-heavy) |

## 3. Секреты

- Закоммичены **только `*.env.example`** (8 шаблонов), реальных `.env` нет. ✅
- Паттерн-скан присваиваний секретов в scope — **0 совпадений**. ✅
- История git (5 941 коммит): маркеры приватных ключей (`BEGIN PRIVATE KEY`) —
  **не найдены**. ✅
- В `vercel.json`/`netlify.toml` секретов нет (проверено ранее). ✅

## 4. SCA / зависимости (свежий `pnpm audit`, 2026-06-15)

Сводка: **critical 0 · high 9 · moderate 15 · low 2 · info 0** (prod-срез).

Важная классификация:
- **Единственная CRITICAL — dev-only:** `@vitest/browser` (тест-инструмент, НЕ
  попадает в production-бандл). Действие: обновить dev-зависимость.
- **Prod-runtime HIGH (приоритет):** открытые advisory **Next.js** (DoS Server
  Components, SSRF, Middleware/Proxy bypass в Pages Router) → **бампнуть Next до
  последнего патча 14.2.x**. Это уточняет более раннюю заметку: часть Next-
  advisory всё ещё открыта на текущей версии.
- **Транзитивные HIGH:** `lodash` (`_.template` code injection), `fast-uri`
  (path traversal/host confusion), `picomatch` (ReDoS), `glob`, `tmp`,
  `multer` (DoS; на стороне api). Действие: обновить/заменить в deps-PR.

Находка **SCA-003 (HIGH, owner-side):** обновить Next.js + транзитивные пакеты;
правка lockfile вне scope autopilot → отдельный deps-PR. Гейт
`dependency-review.yml` (fail-on critical) активен на каждом PR.

## 5. Хранение на клиенте (152-ФЗ контекст)

`localStorage`/`sessionStorage` (29 обращений) хранят **только**: тему
(`pc-theme`, `PLATFORM_V7_THEME_*`), историю и чек-листы по сделке
(`checklistKey`/`storageKey`/`HISTORY_KEY`). **Персональные данные на клиенте не
сохраняются.** ✅
- **OBS-001 (LOW):** per-deal чек-лист/история в localStorage — клиентское
  состояние (теряется при очистке/смене устройства). Для пилота приемлемо; при
  go-live перенести в серверное хранилище.

## 6. Owner-side scaffolding уже в репозитории

`config/` содержит готовые каркасы под подключение (ускоряет owner-side):
- `config/integration/integration.env.example`,
  `config/integration/sber-business-and-bank.env.example` — ENV-шаблоны интеграций/identity;
- `config/modes/{demo,pilot,pilot-controlled,runtime.full}.env.example` — режимы;
- `config/catalog/federal-counterparties.catalog.json`,
  `service-providers.catalog.json` — справочники;
- `config/pilot/tambov.pilot.json`, `config/fixtures/tambov-pilot-fixtures.json` —
  пилотная конфигурация;
- `config/release/release-package.manifest.json` — манифест релиза.

## 7. Карта маршрутов (топ-сегменты, из 181 page.tsx)

deals 18 · seller 12 · buyer 12 · bank 9 · support 6 · control-tower 6 · batches 5
· demo 5 · reports 4 · lots 4 · logistics 4 · elevator 4 · surveyor 3 · driver 3
· disputes 3 · security 2 · readiness 2 · operator 2 · lab 2 · investor 2 ·
integrations 2 · executive 2 · documents 2 (+ прочее). Полное ролевое покрытие.

## 8. Сводный severity-реестр (новые/уточнённые находки этого прохода)

| ID | Severity | Находка | Действие | Owner |
|----|----------|---------|----------|-------|
| SCA-003 | HIGH | Next.js + транзитивные open advisories | bump Next 14.2.x + deps | owner-side (deps-PR/lockfile) |
| SCA-004 | INFO | Единственная critical — dev-only `@vitest/browser` | обновить dev-dep | owner-side |
| OBS-001 | LOW | per-deal state в localStorage | перенести в БД при go-live | owner-side (БД) |
| CODE-001 | LOW | 29 `any`/`as any` в scope | при рефакторинге типизировать | in-scope (follow-up) |

Все предыдущие находки (SEC-001…008, CMP-001/002, SOC2-001/003, UX-001…003,
AUD-001) — в `AUDIT_REPORT.md` и `../dd/REMEDIATION_BACKLOG.md`; код-адресуемые
закрыты в серии PR #1808–#1819.

## 9. Вердикт (доказательный)

Кодовая база **чистая по жёстким SAST-критериям** (0 eval/innerHTML/ts-ignore/
console/secrets/http), сильно покрыта тестами (3 413 кейсов), полностью
ролевая (181 маршрут, 484 testid), с готовым owner-side scaffolding. Свежий SCA:
**0 prod-critical**, открытые highs — это обновления Next/транзитивов (deps-PR,
owner-side). Подтверждает: **code-ready для controlled pilot / pre-integration**;
остаток — owner-side (deps-bump, БД, договоры/credentials, IdP, security/legal
review). Ни одного fake-live claim (под постоянным тест-guard'ом).
