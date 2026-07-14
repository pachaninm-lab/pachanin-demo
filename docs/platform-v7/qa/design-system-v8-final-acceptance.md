# Design System v8 — финальная приёмка Platform V7

## 1. Назначение

Документ фиксирует проверяемое завершение визуальной и маршрутной миграции `/platform-v7/*` в Design System v8. Он не подтверждает промышленную эксплуатацию, боевые внешние интеграции, движение денег, production-scale capacity или фактические SLA.

## 2. Целевая архитектура

Активный интерфейс строится по единому контракту:

- отдельный server-rendered public shell;
- отдельный привилегированный Staff authority plane;
- server-verified business role и RBAC до создания защищённого shell;
- один канонический App Shell и task-first Transaction UX;
- одна Сделка как центр логистики, приёмки, качества, документов, денег, спора и доказательств;
- Design System v8 tokens, primitives и CSS Modules без legacy runtime-патчей;
- неизвестные `/platform-v7/*` маршруты закрываются через 404 до auth и role shell.

## 3. Реализованный код

### Маршрутное покрытие

PR #2583 завершил machine-checkable inventory:

- `pageFiles=205`;
- `public=29`;
- `staff-plane=2`;
- `alias-redirect=112`;
- `design-system-v8=62`;
- `protected-legacy=0`;
- `legacyRouteFiles=0`;
- `zeroLegacy=true`.

### Удаление legacy runtime

PR #2585 удалил исторический runtime-слой: `PlatformV7FullStyleRuntime`, `PlatformV7ProtectedTemplateRuntime`, `PlatformV7TemplateGuards`, `PlatformV7TemplateSwitch`, `PlatformV7ProductionCopyPatch` и `PlatformV7ScrollRestorationGuard`.

После него отдельными controlled slices удалены оставшиеся неиспользуемые DOM-патчи, client translation patches и legacy global CSS. Постоянный zero-reference gate выполняется скриптом `scripts/check-design-system-v8-zero-reference.mjs`.

### Fail-closed route boundary

PR #2593 закрепил четыре явных класса маршрутов: public, staff, canonical Design System v8 и server compatibility alias. Любой неизвестный путь вызывает `notFound()` до чтения verified role, login redirect и создания protected shell.

## 4. Постоянная browser/accessibility матрица

Workflow `.github/workflows/design-system-v8-browser-acceptance.yml` запускает production build и отдельный Playwright config `apps/web/playwright.design-system-v8.config.ts`.

Матрица проверяет:

- Chromium desktop 1440 × 900;
- WebKit desktop 1440 × 900;
- Android / Chromium на профиле Pixel 5;
- iPhone / WebKit на профиле iPhone 13;
- все 12 защищённых ролевых root-маршрутов;
- server-issued controlled test identity без назначения authority из URL или client store;
- fixed header;
- мобильную нижнюю навигацию, не более пяти пунктов и touch target не менее 44 px;
- отсутствие горизонтального overflow;
- отсутствие hydration mismatch;
- cumulative layout shift не более 0,1;
- keyboard focus и открытие канонического drawer;
- Axe WCAG 2 A/AA: serious/critical violations = 0;
- forced-colors;
- reduced-motion;
- RU/EN/ZH и корректный `html[lang]`;
- неизвестный маршрут: HTTP 404 без protected shell.

## 5. Exact-head CI evidence

Статус этого раздела обновляется только после завершения workflow на точном head финального PR.

- exact head: `PENDING`;
- merge commit: `PENDING`;
- Design System v8 Gate: `PENDING`;
- browser matrix: `PENDING`;
- Node CI / production build: `PENDING`;
- основной CI / PostgreSQL industrial gates: `PENDING`;
- Security Scan / Security Quality / Dependency Review / CodeQL / Qodana: `PENDING`;
- browser artifact: `PENDING`.

## 6. Что подтверждено после зелёной приёмки

- весь текущий Platform V7 route inventory классифицирован;
- protected legacy routes отсутствуют;
- legacy runtime-компоненты физически удалены и защищены zero-reference gate;
- неизвестные маршруты fail-closed;
- активный shell, mobile navigation, localization и accessibility проходят зафиксированную CI-матрицу;
- текущий код собирается и проходит repository gates.

## 7. Что не подтверждено

Эта работа не подтверждает:

- production deployment и реальную доступность для внешних пользователей;
- live ФГИС «Зерно», СДИЗ, ЭДО, ГИС ЭПД, КЭП, ЕСИА, ERP, CRM или банковые подключения;
- фактические bank callbacks, номинальный счёт или движение денег;
- production-scale нагрузку, HA, provider PITR, RTO/RPO и операционные SLA;
- внешнюю сертификацию безопасности;
- серию реальных полноцикловых сделок и рыночную repeatability.

Эти границы принимаются отдельными программами промышленной интеграционной и эксплуатационной готовности.
