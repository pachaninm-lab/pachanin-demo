# Platform-v7 execution contour progress

Дата фиксации: 2026-05-01
Статус: controlled pilot / demo contour, не production-ready.

## Общий прогресс

| Блок | Готово | Осталось | Статус |
|---|---:|---:|---|
| P0 backlog | 67% | 33% | доменный P0-костяк + route/UI + expanded role visibility + dynamic route coverage |
| P1 backlog | 26% | 74% | начат базовый UX/RBAC/mobile/a11y слой |
| P2 backlog | 5% | 95% | почти не начат |
| Release-gates | 62% | 38% | unit-gates + mobile/visual/DOM role/dynamic route smoke gates |
| Полное ТЗ | 42% | 58% | сильный P0-костяк, не финальный продукт |

## P0 backlog

| ID | Задача | Готово | Осталось | Комментарий |
|---|---|---:|---:|---|
| P0-01 | Bid object и lifecycle | 80% | 20% | типы и функции есть; нужен UI submit/update/withdraw |
| P0-02 | Лента ставок на лоте | 85% | 15% | dynamic route `/lots/[lotId]/bids` подключён и покрыт visual/mobile smoke |
| P0-03 | Акцепт ставки | 78% | 22% | доменная функция и тест есть; нужен настоящий UI action |
| P0-04 | Deal из Bid | 88% | 12% | dynamic route `/deals/[dealId]` подключён к timeline screen; нужен runtime store/persistence |
| P0-05 | LogisticsRequest из Deal | 72% | 28% | доменная функция и экран заявок есть |
| P0-06 | LogisticsQuote | 67% | 33% | доменная функция и экран предложения есть |
| P0-07 | Trip из LogisticsQuote | 72% | 28% | доменная функция и экран рейса есть |
| P0-08 | Очистить внешний UI от technical terms | 55% | 45% | scanner + visible-copy e2e gate есть; dynamic routes добавлены в visual smoke |
| P0-09 | Убрать AI из внешнего DOM | 10% | 90% | не закрыто; старый AI route остаётся |
| P0-10 | Закрыть водительский RBAC | 90% | 10% | driver DOM + buyer sealed mode + unit role matrix + DOM role smoke для logistics/elevator/lab |
| P0-11 | Mobile release-gates | 62% | 38% | 18 viewports + overflow + dynamic route mobile coverage; screenshot baseline ещё нет |
| P0-12 | Убрать hardcoded KPI | 30% | 70% | buyer-safe экран больше не раскрывает чужие ставки/минимум продавца; старые KPI ещё есть |
| P0-13 | Связать документы с деньгами | 60% | 40% | release safety учитывает документы; нужен UI/route bank integration |
| P0-14 | Data consistency tests | 72% | 28% | unit consistency test есть; dynamic route smoke добавлен, нужен полный cross-screen e2e |

Средний P0 прогресс: 67%.

## P1 backlog

| ID | Задача | Готово | Осталось |
|---|---|---:|---:|
| P1-01 | Seller bid comparison | 70% | 30% |
| P1-02 | Buyer bid status UX | 45% | 55% |
| P1-03 | Rejection reasons | 70% | 30% |
| P1-04 | Change request после акцепта | 0% | 100% |
| P1-05 | Logistics inbox | 45% | 55% |
| P1-06 | Carrier assignment | 35% | 65% |
| P1-07 | Offline queue field roles | 20% | 80% |
| P1-08 | Metric passport investor | 0% | 100% |
| P1-09 | Единый lexicon file | 10% | 90% |
| P1-10 | Mobile table-to-card system | 45% | 55% |

Средний P1 прогресс: 26%.

## Release-gates

| Gate | Готово | Осталось | Комментарий |
|---|---:|---:|---|
| Forbidden DOM terms scanner | 60% | 40% | функция, unit-test и visible-copy e2e gate есть; dynamic routes добавлены в visual smoke |
| RBAC DOM tests | 70% | 30% | driver DOM + buyer sealed-mode + logistics/elevator/lab DOM gates |
| Bid lifecycle tests | 75% | 25% | unit covered + seller bid route visual smoke; нужен UI lifecycle action |
| Deal creation tests | 78% | 22% | unit covered + deal dynamic route visual smoke |
| Logistics lifecycle tests | 67% | 33% | unit covered + logistics routes in e2e |
| Money release safety tests | 60% | 40% | unit covered; нужен bank route cleanup |
| Mobile screenshot tests | 20% | 80% | 18 viewports + dynamic routes; screenshots не сохраняются как baseline |
| Dark/light screenshot tests | 35% | 65% | light/dark readability smoke есть; screenshot baseline нет |
| No horizontal scroll test | 70% | 30% | все 18 viewports по P0-страницам + dynamic routes |
| Console clean test | 45% | 55% | console/page runtime smoke gate есть, но dynamic routes не добавлены из-за tool block |
| Data consistency test | 72% | 28% | unit covered; dynamic routes связаны с demo graph |
| Visual regression test | 25% | 75% | visual smoke покрывает dynamic routes; diff baseline нет |
| Keyboard navigation test | 50% | 50% | базовый Tab/focus smoke + общая keyboard-entry точка P7Page |
| Focus visible test | 40% | 60% | есть фокусируемая точка входа; полноценный focus-visible стиль ещё не доказан |
| Touch target size test | 45% | 55% | driver primary actions + P7Page keyboard-entry покрыты min 44px |
| Role visibility matrix test | 85% | 15% | unit matrix + DOM gates for buyer/driver/logistics/elevator/lab; нужен bank/investor DOM route |

Средний release-gates прогресс: 62%.

## Подключённые route-блоки

| Route | Статус |
|---|---|
| `/platform-v7/lots` | подключено |
| `/platform-v7/buyer` | подключено к buyer-safe экрану |
| `/platform-v7/seller` | подключено |
| `/platform-v7/logistics/requests` | подключено |
| `/platform-v7/logistics/trips` | подключено |
| `/platform-v7/driver` | подключено |
| `/platform-v7/elevator` | подключено |
| `/platform-v7/lab` | подключено |
| `/platform-v7/lots/[lotId]/bids` | подключено |
| `/platform-v7/deals/[dealId]` | подключено к новому timeline screen |
| `/platform-v7/bank/release-safety` | не очищено |

Route coverage по текущему P0-набору: 10 из 11 = 91%.

## Деплой текущего прохода

Каждый commit в этой ветке запускает Vercel preview deployments.

Последний проверенный SHA: `bde0a4bf6d8bf3357c05ee9b98e678a2603f342e`.

Статус Vercel по SHA `bde0a4bf6d8bf3357c05ee9b98e678a2603f342e`:

| Контур | Статус |
|---|---|
| `pachanin-demo-api` | success |
| `pachanin-demo-api-ovdc` | success |
| `pachanin-demo-landing` | success |
| `pachanin-canonical-web` | pending |

Production merge/deploy запрещён до зелёного `pachanin-canonical-web` и закрытия draft PR.

## Заблокированные точки текущего прохода

1. Прямое обновление `/platform-v7/bank/release-safety/page.tsx` было заблокировано инструментом записи.
2. Обновление `platform-v7-a11y-runtime-smoke.spec.ts` было заблокировано инструментом записи.
3. Локальный запуск `typecheck/test/build` из этого интерфейса не выполнялся.
4. PR отстаёт от актуального `main`; перед merge нужен rebase/update branch.
5. `pachanin-canonical-web` остаётся pending на момент проверки.

## Следующий проход

1. Дожать последний route `/platform-v7/bank/release-safety` через допустимый путь записи или новый safe-screen.
2. Добавить bank/investor DOM role gates.
3. Добавить screenshot baselines для mobile/dark-light.
4. Починить/обойти update block в runtime/a11y smoke.
5. Прогнать CI и только после зелёного CI переводить PR из draft в ready.
