# Platform-v7 execution contour progress

Дата фиксации: 2026-05-01
Статус: controlled pilot / demo contour, не production-ready.

## Общий прогресс

| Блок | Готово | Осталось | Статус |
|---|---:|---:|---|
| P0 backlog | 81% | 19% | P0-костяк + bid runtime command/event layer + cross-screen smoke + green Vercel preview |
| P1 backlog | 33% | 67% | начат UX/RBAC/mobile/a11y/finance visibility/visual capture/bid action/runtime слой |
| P2 backlog | 5% | 95% | почти не начат |
| Release-gates | 81% | 19% | unit-gates + mobile/visual/DOM role/finance/full route/runtime/action/API/cross-screen smoke gates |
| Полное ТЗ | 56% | 44% | сильный P0-костяк, не финальный продукт |

## P0 backlog

| ID | Задача | Готово | Осталось | Комментарий |
|---|---|---:|---:|---|
| P0-01 | Bid object и lifecycle | 92% | 8% | типы, доменные функции, UI actions, server-side in-memory command/event layer, API gates есть; нужна durable DB/event-store |
| P0-02 | Лента ставок на лоте | 90% | 10% | seller route `/lots/[lotId]/bids` подключён к lifecycle panel, runtime API и visual/action smoke |
| P0-03 | Акцепт ставки | 92% | 8% | accept action wired через command API + event journal + idempotency gate; нужен durable persistence |
| P0-04 | Deal из Bid | 90% | 10% | runtime accept создаёт deal projection; `/deals/[id]` показывает clean timeline; нужен cross-screen runtime hydration сделки |
| P0-05 | LogisticsRequest из Deal | 76% | 24% | доменная функция и экран заявок есть; cross-screen smoke проверяет переход к логистике |
| P0-06 | LogisticsQuote | 69% | 31% | доменная функция и экран предложения есть; нужен интерактивный lifecycle перевозчика |
| P0-07 | Trip из LogisticsQuote | 74% | 26% | доменная функция и экран рейса есть; dynamic `/logistics/trips/[tripId]` ещё не создан |
| P0-08 | Очистить внешний UI от technical terms | 72% | 28% | scanner + visible-copy e2e gate есть; runtime UI не выводит technical copy |
| P0-09 | Убрать AI из внешнего DOM | 10% | 90% | не закрыто; старый AI route остаётся |
| P0-10 | Закрыть водительский RBAC | 94% | 6% | buyer sealed-mode + driver/logistics/elevator/lab + bank/investor gates есть |
| P0-11 | Mobile release-gates | 76% | 24% | 18 viewports + overflow + all 11 P0 routes + screenshot-capture smoke; pixel baseline ещё нет |
| P0-12 | Убрать hardcoded KPI | 42% | 58% | часть buyer/bank-safe слоя очищена; старые KPI ещё есть в других контурах |
| P0-13 | Связать документы с деньгами | 82% | 18% | release safety route подключён и включён в cross-screen smoke; нужен runtime link из конкретной сделки |
| P0-14 | Data consistency tests | 82% | 18% | unit consistency + runtime API + cross-screen smoke: bid → deal → logistics → trip → money |

Средний P0 прогресс: 81%.

## P1 backlog

| ID | Задача | Готово | Осталось |
|---|---|---:|---:|
| P1-01 | Seller bid comparison | 80% | 20% |
| P1-02 | Buyer bid status UX | 62% | 38% |
| P1-03 | Rejection reasons | 78% | 22% |
| P1-04 | Change request после акцепта | 0% | 100% |
| P1-05 | Logistics inbox | 48% | 52% |
| P1-06 | Carrier assignment | 35% | 65% |
| P1-07 | Offline queue field roles | 20% | 80% |
| P1-08 | Metric passport investor | 10% | 90% |
| P1-09 | Единый lexicon file | 10% | 90% |
| P1-10 | Mobile table-to-card system | 45% | 55% |
| P1-11 | Screenshot capture smoke | 45% | 55% |
| P1-12 | Bid lifecycle UI actions | 70% | 30% |
| P1-13 | Runtime bid command/event layer | 55% | 45% |
| P1-14 | Cross-screen execution smoke | 45% | 55% |

Средний P1 прогресс: 33%.

## Release-gates

| Gate | Готово | Осталось | Комментарий |
|---|---:|---:|---|
| Forbidden DOM terms scanner | 72% | 28% | функция, unit-test, visible-copy e2e и bank/runtime route cleanup есть |
| RBAC DOM tests | 82% | 18% | buyer sealed-mode + driver/logistics/elevator/lab + bank/investor smoke |
| Bid lifecycle tests | 90% | 10% | unit covered + clickable UI smoke + runtime API smoke + negative gates |
| Deal creation tests | 86% | 14% | unit covered + runtime accept creates deal projection + cross-screen smoke |
| Logistics lifecycle tests | 70% | 30% | unit covered + logistics routes in visual/cross-screen e2e |
| Money release safety tests | 86% | 14% | unit covered + bank release route + cross-screen smoke |
| Mobile screenshot tests | 45% | 55% | screenshot-capture smoke есть для ключевых mobile routes; сохранённых baseline-снимков нет |
| Dark/light screenshot tests | 50% | 50% | screenshot-capture smoke есть для light/dark на ключевых routes; pixel diff baseline нет |
| No horizontal scroll test | 80% | 20% | все 18 viewports по всем 11 P0 routes |
| Console clean test | 68% | 32% | runtime supplemental gates + new API/cross-screen smoke; полный browser console pass ещё не закрыт |
| Data consistency test | 82% | 18% | unit consistency + runtime API + cross-screen smoke |
| Visual regression test | 48% | 52% | visual smoke + screenshot-capture smoke есть; diff baseline нет |
| Keyboard navigation test | 62% | 38% | bid action buttons есть; полноценный keyboard flow ещё не доказан |
| Focus visible test | 45% | 55% | есть фокусируемые действия; полноценный focus-visible стиль ещё не доказан |
| Touch target size test | 52% | 48% | driver actions + bid lifecycle buttons min-height 44px |
| Role visibility matrix test | 94% | 6% | unit matrix + DOM/API gates for buyer/driver/logistics/elevator/lab/bank/investor |
| Vercel preview deploy gate | 100% | 0% | latest SHA green across canonical-web/demo-api/demo-api-ovdc/demo-landing |

Средний release-gates прогресс: 81%.

## Подключённые route-блоки

| Route | Статус |
|---|---|
| `/platform-v7/lots` | подключено |
| `/platform-v7/buyer` | подключено к buyer-safe lifecycle screen |
| `/platform-v7/seller` | подключено |
| `/platform-v7/logistics/requests` | подключено |
| `/platform-v7/logistics/trips` | подключено |
| `/platform-v7/logistics/trips/[tripId]` | не закрыто; попытка создать route была заблокирована инструментом записи |
| `/platform-v7/driver` | подключено |
| `/platform-v7/elevator` | подключено |
| `/platform-v7/lab` | подключено |
| `/platform-v7/lots/[lotId]/bids` | подключено к seller bid lifecycle actions |
| `/platform-v7/deals/[id]` | очищено и подключено к clean timeline screen |
| `/platform-v7/bank/release-safety` | очищено и подключено к execution-contour screen |
| `/api/platform-v7/bids/runtime` | подключено |
| `/api/platform-v7/bids/runtime/command` | подключено |

P0 route coverage по текущему проверяемому набору: 11 из 11 = 100%.
ТЗ route coverage с учётом dynamic trip detail: не закрыто полностью.

## Деплой текущего прохода

Каждый commit в этой ветке запускает Vercel preview deployments.

Последний проверенный code SHA: `c356105c9afb3cd39cf02b5fc48e00008ead1906`.

Статус Vercel по SHA `c356105c9afb3cd39cf02b5fc48e00008ead1906`:

| Контур | Статус |
|---|---|
| `pachanin-demo-api` | success |
| `pachanin-demo-api-ovdc` | success |
| `pachanin-demo-landing` | success |
| `pachanin-canonical-web` | success |

Production merge/deploy не выполнялся: PR остаётся draft, локальная проверка `typecheck/test/build` из этого интерфейса не выполнена.

## Что закрыто в последних проходах

1. Добавлен `BidLifecyclePanel`.
2. Seller route получил действия: принять ставку, запросить уточнение, отклонить с причиной.
3. Buyer route получил действия: повысить свою ставку, отозвать свою ставку, отправить новую при отсутствии активной.
4. Добавлен журнал действий и aria-live feedback.
5. Buyer sealed-mode hardened: покупатель не видит чужие ставки, best bid и seller floor.
6. Добавлен server-side in-memory runtime store для bid commands/events.
7. Добавлены API routes `/api/platform-v7/bids/runtime` и `/api/platform-v7/bids/runtime/command`.
8. Добавлен CSRF flow для bid runtime.
9. Добавлены server-side guards: чужая ставка, закрытая ставка, idempotency.
10. Добавлен clickable Playwright smoke `platform-v7-bid-lifecycle-actions.spec.ts`.
11. Добавлен API smoke `platform-v7-bid-runtime-api.spec.ts`.
12. Добавлен cross-screen smoke `platform-v7-cross-screen-contour.spec.ts`: accepted bid → deal → logistics → trip → money.
13. Visual smoke выровнен под новый lifecycle UI.

## Ограничения и blockers

1. Runtime store пока server-side in-memory, не durable DB/event-store.
2. State может сбрасываться при restart/deploy/serverless cold start.
3. Dynamic route `/platform-v7/logistics/trips/[tripId]` не создан: запись файла с `[tripId]` была заблокирована инструментом.
4. Обновление `platform-v7-a11y-runtime-smoke.spec.ts` было заблокировано инструментом записи, поэтому ранее добавлен отдельный `platform-v7-runtime-supplemental.spec.ts`.
5. Локальный запуск `typecheck/test/build` из этого интерфейса не выполнялся.
6. PR отстаёт от актуального `main`; перед merge нужен rebase/update branch.
7. Screenshot gate пока capture-only, без сохранённого pixel-diff baseline.
8. AI route/external DOM вопрос не закрыт.

## Следующий проход

1. Добавить durable persistence для bid commands/events или адаптер к существующему runtime command API.
2. Закрыть dynamic trip detail route `/platform-v7/logistics/trips/[tripId]`.
3. Добавить rollback/error states в UI для runtime command failures.
4. Начать logistics lifecycle actions: quote → accept quote → create trip через command/event слой.
