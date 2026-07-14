# Design System v8 — финальная browser/accessibility acceptance

**Программа:** issue #2516  
**Базовый main:** `340ed53574a0c6688eafa3fbf273db305097aec3`  
**Статус документа:** acceptance-контракт зафиксирован; exact-head результат заполняется после CI текущего PR.

## 1. Суть

Кодовая миграция Platform V7 в Design System v8 завершена до нулевого legacy inventory:

- `protected-legacy=0`;
- `legacyRouteFiles=0`;
- `zeroLegacy=true`;
- удалены legacy runtime/template guards;
- удалены obsolete DOM mutation, viewport polling, copy-repair и CSS patch chains;
- shell policy формируется из server-verified роли и protected pathname;
- production references к удалённому runtime/style слою равны нулю.

Этот документ фиксирует последний обязательный acceptance-слой: browser-accessibility matrix на production build.

## 2. Machine-checkable matrix

Workflow `.github/workflows/platform-v7-design-system-v8-acceptance.yml` обязан:

1. установить Chromium и WebKit;
2. собрать production bundle `@pc/web`;
3. запустить `playwright.acceptance.config.ts`;
4. сохранить JSON, HTML report, traces, screenshots и videos при сбоях;
5. опубликовать итоговую статистику в GitHub Step Summary.

Проекты Playwright:

| Проект | Движок | Профиль |
|---|---|---|
| `desktop-chromium` | Chromium | Desktop Chrome, 1440×1000 |
| `desktop-webkit` | WebKit | Desktop Safari, 1440×1000 |
| `android-chromium` | Chromium | Pixel 5 |
| `iphone-webkit` | WebKit | iPhone 13 |

## 3. Проверяемые критерии

### Публичный контур

- `/platform-v7` открывается без runtime/hydration ошибок;
- RU/EN/ZH меняют серверный `html[lang]`;
- нет горизонтального overflow;
- первый Tab попадает в именованный интерактивный элемент;
- Axe не выявляет serious/critical нарушений WCAG 2 A/AA, 2.1 AA и 2.2 AA;
- CLS не превышает `0.1`.

### Вход

- `/platform-v7/login` доступен с клавиатуры;
- нет горизонтального overflow;
- Axe не выявляет serious/critical нарушений;
- нет hydration/page errors;
- CLS не превышает `0.1`.

### Media/accessibility modes

- `prefers-reduced-motion: reduce` подтверждается во всех проектах;
- `forced-colors: active` подтверждается в Chromium, где Playwright предоставляет достоверную эмуляцию;
- интерфейс остаётся доступным с клавиатуры и без overflow.

### 12 protected roles

Проверяются роли:

`operator`, `buyer`, `seller`, `logistics`, `driver`, `surveyor`, `elevator`, `lab`, `bank`, `arbitrator`, `compliance`, `executive`.

Для каждой роли создаётся криптографически подписанная `pc_v7_cabinet` session через действующий `signCabinetSession`. URL, query, `pc-role`, localStorage и browser-owned role не используются как authority.

Для каждого кабинета проверяются:

- успешный protected response без redirect на login;
- наличие единого App Shell;
- фиксированная шапка в верхней границе viewport;
- контент не заходит под шапку;
- фиксированная role-specific нижняя навигация;
- от 1 до 5 пунктов нижней навигации;
- отсутствие горизонтального overflow;
- mobile touch targets не менее 42×42 px;
- Axe и CLS на operator reference cockpit;
- отсутствие pageerror и hydration/React console errors.

## 4. Граница доказательства

Успешный browser-accessibility matrix доказывает архитектурную и интерфейсную готовность текущего кода Design System v8 в контролируемом CI-контуре.

Он **не доказывает**, что:

- production и live-внешние интеграции подтверждены;
- ФГИС, ЭДО, ГИС ЭПД, ЕСИА или банк подключены в промышленной эксплуатации;
- проведена серия реальных полноцикловых сделок;
- подтверждены live bank callbacks и release денежных средств;
- доказаны SLA, пользовательская нагрузка и эксплуатационная устойчивость внешней инфраструктуры.

## 5. Exact-head evidence

Заполняется после успешного CI:

- PR: pending;
- head SHA: pending;
- workflow run: pending;
- artifact: `platform-v7-design-system-v8-acceptance-<sha>`;
- browser-accessibility matrix: pending;
- production build: pending;
- итог issue #2516: закрывается только после exact-head green и повторной проверки `main`.
