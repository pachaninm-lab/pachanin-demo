# Platform-v7 execution contour progress

Дата фиксации: 2026-05-01
Статус: controlled pilot / demo contour, не production-ready.

## Общий прогресс

| Блок | Готово | Осталось | Статус |
|---|---:|---:|---|
| P0 backlog | 71% | 29% | доменный P0-костяк + route/UI + expanded role visibility + full P0 route coverage |
| P1 backlog | 27% | 73% | начат базовый UX/RBAC/mobile/a11y слой |
| P2 backlog | 5% | 95% | почти не начат |
| Release-gates | 66% | 34% | unit-gates + mobile/visual/DOM role/full route smoke gates |
| Полное ТЗ | 45% | 55% | сильный P0-костяк, не финальный продукт |

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
| P0-08 | Очистить внешний UI от technical terms | 68% | 32% | scanner + visible-copy e2e gate есть; bank route очищен от старого technical copy |
| P0-09 | Убрать AI из внешнего DOM | 10% | 90% | не закрыто; старый AI route остаётся |
| P0-10 | Закрыть водительский RBAC | 90% | 10% | driver DOM + buyer sealed mode + unit role matrix + DOM role smoke для logistics/elevator/lab |
| P0-11 | Mobile release-gates | 70% | 30% | 18 viewports + overflow + all 11 P0 routes; screenshot baseline ещё нет |
| P0-12 | Убрать hardcoded KPI | 32% | 68% | buyer-safe экран и bank-safe экран частично убрали старый слой; старые KPI ещё есть |
| P0-13 | Связать документы с деньгами | 78% | 22% | release safety route подключён к чистому execution-contour screen и покрыт visual/mobile smoke |
| P0-14 | Data consistency tests | 74% | 26% | unit consistency test есть; all P0 routes связаны с demo graph; нужен полный cross-screen e2e |

Средний P0 прогресс: 71%.

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

Средний P1 прогресс: 27%.

## Release-gates

| Gate | Готово | Осталось | Комментарий |
|---|---:|---:|---|
| Forbidden DOM terms scanner | 70% | 30% | функция, unit-test, visible-copy e2e и bank route cleanup есть |
| RBAC DOM tests | 70% | 30% | driver DOM + buyer sealed-mode + logistics/elevator/lab DOM gates |
| Bid lifecycle tests | 75% | 25% | unit covered + seller bid route visual smoke; нужен UI lifecycle action |
| Deal creation tests | 78% | 22% | unit covered + deal dynamic route visual smoke |
| Logistics lifecycle tests | 67% | 33% | unit covered + logistics routes in e2e |
| Money release safety tests | 78% | 22% | unit covered + bank release safety route cleanup + visual/mobile smoke |
| Mobile screenshot tests | 30% | 70% | 18 viewports + all P0 routes; screenshots не сохраняются как baseline |
| Dark/light screenshot tests | 35% | 65% | light/dark readability smoke есть; screenshot baseline нет |
| No horizontal scroll test | 80% | 20% | все 18 viewports по всем 11 P0 routes |
| Console clean test | 45% | 55% | console/page runtime smoke gate есть, но dynamic/bank routes не добавлены из-за tool block |
| Data consistency test | 74% | 26% | unit covered; all P0 routes связаны с demo graph |
| Visual regression test | 35% | 65% | visual smoke покрывает all P0 routes; diff baseline нет |
| Keyboard navigation test | 50% | 50% | базовый Tab/focus smoke + общая keyboard-entry точка P7Page |
| Focus visible test | 40% | 60% | есть фокусируемая точка входа; полноценный focus-visible стиль ещё не доказан |
| Touch target size test | 48% | 52% | driver primary actions + P7Page keyboard-entry покрыты min 44px |
| Role visibility matrix test | 85% | 15% | unit matrix + DOM gates for buyer/driver/logistics/elevator/lab; нужен bank/investor DOM route |

Средний release-gates прогресс: 66%.

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
| `/platform-v7/bank/release-safety` | очищено и подключено к execution-contour screen |

Route coverage по текущему P0-набору: 11 из 11 = 100%.

## Деплой текущего прохода

Каждый commit в этой ветке запускает Vercel preview deployments.

Последний проверенный SHA: `fcb924e7a4d6b84ff9d570a9b625de94154fd50c`.

Статус Vercel по SHA `fcb924e7a4d6b84ff9d570a9b625de94154fd50c` на момент первой проверки: pending по всем контурам.

Production merge/deploy запрещён до зелёного `pachanin-canonical-web` и закрытия draft PR.

## Заблокированные точки текущего прохода

1. Обновление `platform-v7-a11y-runtime-smoke.spec.ts` было заблокировано инструментом записи.
2. Локальный запуск `typecheck/test/build` из этого интерфейса не выполнялся.
3. PR отстаёт от актуального `main`; перед merge нужен rebase/update branch.
4. `pachanin-canonical-web` остаётся pending на момент проверки.

## Следующий проход

1. Добавить bank/investor DOM role gates.
2. Добавить screenshot baselines для mobile/dark-light.
3. Починить/обойти update block в runtime/a11y smoke.
4. Начать UI lifecycle actions для submit/update/withdraw/accept bid.
5. Прогнать CI и только после зелёного CI переводить PR из draft в ready.
