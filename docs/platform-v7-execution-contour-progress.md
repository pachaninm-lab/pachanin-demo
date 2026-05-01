# Platform-v7 execution contour progress

Дата фиксации: 2026-05-01
Статус: controlled pilot / demo contour, не production-ready.

## Общий прогресс

| Блок | Готово | Осталось | Статус |
|---|---:|---:|---|
| P0 backlog | 75% | 25% | доменный P0-костяк + route/UI + expanded role visibility + full P0 route coverage + green Vercel preview |
| P1 backlog | 29% | 71% | начат базовый UX/RBAC/mobile/a11y/finance visibility/visual capture слой |
| P2 backlog | 5% | 95% | почти не начат |
| Release-gates | 75% | 25% | unit-gates + mobile/visual/DOM role/finance/full route/runtime/screenshot-capture gates + green preview deploy |
| Полное ТЗ | 50% | 50% | сильный P0-костяк, не финальный продукт |

## P0 backlog

| ID | Задача | Готово | Осталось | Комментарий |
|---|---|---:|---:|---|
| P0-01 | Bid object и lifecycle | 80% | 20% | типы и функции есть; нужен UI submit/update/withdraw |
| P0-02 | Лента ставок на лоте | 85% | 15% | dynamic route `/lots/[lotId]/bids` подключён и покрыт visual/mobile/runtime smoke |
| P0-03 | Акцепт ставки | 78% | 22% | доменная функция и тест есть; нужен настоящий UI action |
| P0-04 | Deal из Bid | 88% | 12% | dynamic route `/deals/[id]` подключён к clean timeline screen; нужен runtime store/persistence |
| P0-05 | LogisticsRequest из Deal | 72% | 28% | доменная функция и экран заявок есть |
| P0-06 | LogisticsQuote | 67% | 33% | доменная функция и экран предложения есть |
| P0-07 | Trip из LogisticsQuote | 72% | 28% | доменная функция и экран рейса есть |
| P0-08 | Очистить внешний UI от technical terms | 68% | 32% | scanner + visible-copy e2e gate есть; bank route очищен от старого technical copy |
| P0-09 | Убрать AI из внешнего DOM | 10% | 90% | не закрыто; старый AI route остаётся |
| P0-10 | Закрыть водительский RBAC | 92% | 8% | driver/buyer/logistics/elevator/lab + bank/investor visibility smoke |
| P0-11 | Mobile release-gates | 76% | 24% | 18 viewports + overflow + all 11 P0 routes + screenshot-capture smoke; pixel baseline ещё нет |
| P0-12 | Убрать hardcoded KPI | 32% | 68% | buyer-safe экран и bank-safe экран частично убрали старый слой; старые KPI ещё есть |
| P0-13 | Связать документы с деньгами | 80% | 20% | release safety route подключён к чистому execution-contour screen и покрыт visual/mobile/runtime smoke |
| P0-14 | Data consistency tests | 76% | 24% | unit consistency test есть; all P0 routes связаны с demo graph; duplicate deal route build-breaker снят |

Средний P0 прогресс: 75%.

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
| P1-08 | Metric passport investor | 10% | 90% |
| P1-09 | Единый lexicon file | 10% | 90% |
| P1-10 | Mobile table-to-card system | 45% | 55% |
| P1-11 | Screenshot capture smoke | 45% | 55% |

Средний P1 прогресс: 29%.

## Release-gates

| Gate | Готово | Осталось | Комментарий |
|---|---:|---:|---|
| Forbidden DOM terms scanner | 70% | 30% | функция, unit-test, visible-copy e2e и bank route cleanup есть |
| RBAC DOM tests | 75% | 25% | driver/buyer/logistics/elevator/lab + bank/investor finance visibility smoke |
| Bid lifecycle tests | 76% | 24% | unit covered + seller bid route visual/runtime smoke; нужен UI lifecycle action |
| Deal creation tests | 82% | 18% | unit covered + `/deals/[id]` clean route + Vercel route table green |
| Logistics lifecycle tests | 67% | 33% | unit covered + logistics routes in e2e |
| Money release safety tests | 84% | 16% | unit covered + bank release safety route cleanup + visual/mobile/runtime/finance visibility smoke |
| Mobile screenshot tests | 45% | 55% | screenshot-capture smoke есть для ключевых mobile routes; сохранённых baseline-снимков нет |
| Dark/light screenshot tests | 50% | 50% | screenshot-capture smoke есть для light/dark на ключевых routes; pixel diff baseline нет |
| No horizontal scroll test | 80% | 20% | все 18 viewports по всем 11 P0 routes |
| Console clean test | 65% | 35% | old runtime smoke + supplemental runtime gate для dynamic/bank routes |
| Data consistency test | 76% | 24% | unit covered; all P0 routes связаны с demo graph |
| Visual regression test | 45% | 55% | visual smoke + screenshot-capture smoke есть; diff baseline нет |
| Keyboard navigation test | 60% | 40% | базовый Tab/focus smoke + supplemental keyboard-entry для dynamic/bank routes |
| Focus visible test | 45% | 55% | есть фокусируемая точка входа; полноценный focus-visible стиль ещё не доказан |
| Touch target size test | 48% | 52% | driver primary actions + P7Page keyboard-entry покрыты min 44px |
| Role visibility matrix test | 92% | 8% | unit matrix + DOM gates for buyer/driver/logistics/elevator/lab/bank/investor |
| Vercel preview deploy gate | 100% | 0% | latest SHA green across canonical-web/demo-api/demo-api-ovdc/demo-landing |

Средний release-gates прогресс: 75%.

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
| `/platform-v7/deals/[id]` | очищено и подключено к clean timeline screen |
| `/platform-v7/bank/release-safety` | очищено и подключено к execution-contour screen |

Route coverage по текущему P0-набору: 11 из 11 = 100%.

## Деплой текущего прохода

Каждый commit в этой ветке запускает Vercel preview deployments.

Последний проверенный code SHA: `a25d762ef80728e079e66981c800d782c2af2ca9`.

Статус Vercel по SHA `a25d762ef80728e079e66981c800d782c2af2ca9`:

| Контур | Статус |
|---|---|
| `pachanin-demo-api` | success |
| `pachanin-demo-api-ovdc` | success |
| `pachanin-demo-landing` | success |
| `pachanin-canonical-web` | success / READY |

Причина предыдущего падения `pachanin-canonical-web`: duplicate dynamic route в сегменте `/platform-v7/deals` — одновременно существовали `[id]` и `[dealId]`. Исправление: существующий `[id]` переведён на clean timeline screen, duplicate `[dealId]` удалён.

Production merge/deploy не выполнялся: PR остаётся draft, локальная проверка `typecheck/test/build` из этого интерфейса не выполнена.

## Заблокированные точки текущего прохода

1. Обновление `platform-v7-a11y-runtime-smoke.spec.ts` было заблокировано инструментом записи, поэтому добавлен отдельный `platform-v7-runtime-supplemental.spec.ts`.
2. Первая попытка создать подробный finance visibility smoke была заблокирована инструментом записи, поэтому добавлен сокращённый `platform-v7-finance-visibility.spec.ts`.
3. Локальный запуск `typecheck/test/build` из этого интерфейса не выполнялся.
4. PR отстаёт от актуального `main`; перед merge нужен rebase/update branch.
5. Screenshot gate пока capture-only, без сохранённого pixel-diff baseline.

## Следующий проход

1. Начать UI lifecycle actions для submit/update/withdraw/accept bid.
2. Добавить event journal/toast/optimistic update для bid actions.
3. Прогнать CI и не переводить PR из draft до зелёных проверок.
