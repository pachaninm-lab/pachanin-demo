# Platform-v7 execution contour progress

Дата фиксации: 2026-05-01
Статус: controlled pilot / demo contour, не production-ready.

## Общий прогресс

| Блок | Готово | Осталось | Статус |
|---|---:|---:|---|
| P0 backlog | 78% | 22% | доменный P0-костяк + route/UI + bid lifecycle client actions + role visibility + green Vercel preview |
| P1 backlog | 31% | 69% | начат UX/RBAC/mobile/a11y/finance visibility/visual capture/bid action слой |
| P2 backlog | 5% | 95% | почти не начат |
| Release-gates | 78% | 22% | unit-gates + mobile/visual/DOM role/finance/full route/runtime/screenshot/action smoke gates |
| Полное ТЗ | 53% | 47% | сильный P0-костяк, не финальный продукт |

## P0 backlog

| ID | Задача | Готово | Осталось | Комментарий |
|---|---|---:|---:|---|
| P0-01 | Bid object и lifecycle | 88% | 12% | типы, доменные функции, client UI submit/update/withdraw и e2e smoke есть; нужен backend/runtime persistence |
| P0-02 | Лента ставок на лоте | 88% | 12% | seller route `/lots/[lotId]/bids` подключён к lifecycle panel и visual/action smoke |
| P0-03 | Акцепт ставки | 88% | 12% | accept action wired в client UI + journal + e2e; нужен persistence/API command |
| P0-04 | Deal из Bid | 88% | 12% | dynamic route `/deals/[id]` подключён к clean timeline screen; нужен runtime store/persistence |
| P0-05 | LogisticsRequest из Deal | 72% | 28% | доменная функция и экран заявок есть |
| P0-06 | LogisticsQuote | 67% | 33% | доменная функция и экран предложения есть |
| P0-07 | Trip из LogisticsQuote | 72% | 28% | доменная функция и экран рейса есть |
| P0-08 | Очистить внешний UI от technical terms | 70% | 30% | scanner + visible-copy e2e gate есть; visual smoke укорочен и выровнен с новым UI |
| P0-09 | Убрать AI из внешнего DOM | 10% | 90% | не закрыто; старый AI route остаётся |
| P0-10 | Закрыть водительский RBAC | 94% | 6% | buyer sealed-mode hardened: без чужих ставок, best bid и seller floor; driver/bank/investor gates есть |
| P0-11 | Mobile release-gates | 76% | 24% | 18 viewports + overflow + all 11 P0 routes + screenshot-capture smoke; pixel baseline ещё нет |
| P0-12 | Убрать hardcoded KPI | 40% | 60% | buyer-safe lot card убрала best bid/seller floor; старые KPI ещё есть в других контурах |
| P0-13 | Связать документы с деньгами | 80% | 20% | release safety route подключён к чистому execution-contour screen и покрыт visual/mobile/runtime smoke |
| P0-14 | Data consistency tests | 78% | 22% | unit consistency + all P0 routes + bid action smoke; нужен full cross-screen acceptance flow |

Средний P0 прогресс: 78%.

## P1 backlog

| ID | Задача | Готово | Осталось |
|---|---|---:|---:|
| P1-01 | Seller bid comparison | 78% | 22% |
| P1-02 | Buyer bid status UX | 60% | 40% |
| P1-03 | Rejection reasons | 75% | 25% |
| P1-04 | Change request после акцепта | 0% | 100% |
| P1-05 | Logistics inbox | 45% | 55% |
| P1-06 | Carrier assignment | 35% | 65% |
| P1-07 | Offline queue field roles | 20% | 80% |
| P1-08 | Metric passport investor | 10% | 90% |
| P1-09 | Единый lexicon file | 10% | 90% |
| P1-10 | Mobile table-to-card system | 45% | 55% |
| P1-11 | Screenshot capture smoke | 45% | 55% |
| P1-12 | Bid lifecycle UI actions | 55% | 45% |

Средний P1 прогресс: 31%.

## Release-gates

| Gate | Готово | Осталось | Комментарий |
|---|---:|---:|---|
| Forbidden DOM terms scanner | 70% | 30% | функция, unit-test, visible-copy e2e и bank route cleanup есть |
| RBAC DOM tests | 80% | 20% | buyer sealed-mode + driver/logistics/elevator/lab + bank/investor smoke |
| Bid lifecycle tests | 85% | 15% | unit covered + clickable seller/buyer e2e action smoke |
| Deal creation tests | 82% | 18% | unit covered + `/deals/[id]` clean route + Vercel route table green |
| Logistics lifecycle tests | 67% | 33% | unit covered + logistics routes in e2e |
| Money release safety tests | 84% | 16% | unit covered + bank release safety route cleanup + visual/mobile/runtime/finance visibility smoke |
| Mobile screenshot tests | 45% | 55% | screenshot-capture smoke есть для ключевых mobile routes; сохранённых baseline-снимков нет |
| Dark/light screenshot tests | 50% | 50% | screenshot-capture smoke есть для light/dark на ключевых routes; pixel diff baseline нет |
| No horizontal scroll test | 80% | 20% | все 18 viewports по всем 11 P0 routes |
| Console clean test | 65% | 35% | old runtime smoke + supplemental runtime gate для dynamic/bank routes |
| Data consistency test | 78% | 22% | unit covered; all P0 routes связаны с demo graph; action smoke добавлен |
| Visual regression test | 47% | 53% | visual smoke + screenshot-capture smoke есть; diff baseline нет |
| Keyboard navigation test | 62% | 38% | buttons in bid lifecycle action smoke; полноценный keyboard flow ещё не доказан |
| Focus visible test | 45% | 55% | есть фокусируемые действия; полноценный focus-visible стиль ещё не доказан |
| Touch target size test | 50% | 50% | driver actions + bid lifecycle buttons min-height 44px |
| Role visibility matrix test | 94% | 6% | unit matrix + DOM gates for buyer/driver/logistics/elevator/lab/bank/investor |
| Vercel preview deploy gate | 100% | 0% | latest SHA green across canonical-web/demo-api/demo-api-ovdc/demo-landing |

Средний release-gates прогресс: 78%.

## Подключённые route-блоки

| Route | Статус |
|---|---|
| `/platform-v7/lots` | подключено |
| `/platform-v7/buyer` | подключено к buyer-safe lifecycle screen |
| `/platform-v7/seller` | подключено |
| `/platform-v7/logistics/requests` | подключено |
| `/platform-v7/logistics/trips` | подключено |
| `/platform-v7/driver` | подключено |
| `/platform-v7/elevator` | подключено |
| `/platform-v7/lab` | подключено |
| `/platform-v7/lots/[lotId]/bids` | подключено к seller bid lifecycle actions |
| `/platform-v7/deals/[id]` | очищено и подключено к clean timeline screen |
| `/platform-v7/bank/release-safety` | очищено и подключено к execution-contour screen |

Route coverage по текущему P0-набору: 11 из 11 = 100%.

## Деплой текущего прохода

Каждый commit в этой ветке запускает Vercel preview deployments.

Последний проверенный code SHA: `01d3ce6cd49274295ddd6a20b685e53a9ad6e0b6`.

Статус Vercel по SHA `01d3ce6cd49274295ddd6a20b685e53a9ad6e0b6`:

| Контур | Статус |
|---|---|
| `pachanin-demo-api` | success |
| `pachanin-demo-api-ovdc` | success |
| `pachanin-demo-landing` | success |
| `pachanin-canonical-web` | success |

Production merge/deploy не выполнялся: PR остаётся draft, локальная проверка `typecheck/test/build` из этого интерфейса не выполнена.

## Что закрыто в последнем проходе

1. Добавлен client component `BidLifecyclePanel`.
2. Seller route получил действия: принять ставку, запросить уточнение, отклонить с причиной.
3. Buyer route получил действия: повысить свою ставку, отозвать свою ставку, отправить новую при отсутствии активной.
4. Добавлен журнал действий и aria-live feedback.
5. Buyer sealed-mode hardened: покупатель не видит чужие ставки, best bid и seller floor.
6. Добавлен clickable Playwright smoke `platform-v7-bid-lifecycle-actions.spec.ts`.
7. Visual smoke выровнен под новый lifecycle UI.

## Заблокированные точки текущего прохода

1. Bid lifecycle actions пока client-demo state, без backend/API persistence и без runtime event journal.
2. Обновление `platform-v7-a11y-runtime-smoke.spec.ts` было заблокировано инструментом записи, поэтому ранее добавлен отдельный `platform-v7-runtime-supplemental.spec.ts`.
3. Локальный запуск `typecheck/test/build` из этого интерфейса не выполнялся.
4. PR отстаёт от актуального `main`; перед merge нужен rebase/update branch.
5. Screenshot gate пока capture-only, без сохранённого pixel-diff baseline.

## Следующий проход

1. Добавить runtime/backend persistence для bid actions или отдельный command/event store.
2. Добавить optimistic update rollback/error state и disabled states по статусам.
3. Добавить cross-screen e2e после accept bid: ставка → сделка → логистика → банк.
4. После этого — update/rebase от main и полный CI перед снятием draft.
