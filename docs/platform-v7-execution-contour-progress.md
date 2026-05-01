# Platform-v7 execution contour progress

Дата фиксации: 2026-05-01
Статус: controlled pilot / demo contour, не production-ready.

## Общий прогресс

| Блок | Готово | Осталось | Статус |
|---|---:|---:|---|
| P0 backlog | 83% | 17% | P0-костяк + bid runtime command/event layer + logistics lifecycle UI + cross-screen smoke + green Vercel preview |
| P1 backlog | 35% | 65% | начат UX/RBAC/mobile/a11y/finance visibility/visual capture/bid runtime/logistics action слой |
| P2 backlog | 5% | 95% | почти не начат |
| Release-gates | 83% | 17% | unit-gates + mobile/visual/DOM role/finance/full route/runtime/action/API/cross-screen/logistics action smoke gates |
| Полное ТЗ | 59% | 41% | сильный P0-костяк, не финальный продукт |

## P0 backlog

| ID | Задача | Готово | Осталось | Комментарий |
|---|---|---:|---:|---|
| P0-01 | Bid object и lifecycle | 92% | 8% | типы, доменные функции, UI actions, server-side in-memory command/event layer, API gates есть; нужна durable DB/event-store |
| P0-02 | Лента ставок на лоте | 90% | 10% | seller route `/lots/[lotId]/bids` подключён к lifecycle panel, runtime API и visual/action smoke |
| P0-03 | Акцепт ставки | 92% | 8% | accept action wired через command API + event journal + idempotency gate; нужен durable persistence |
| P0-04 | Deal из Bid | 90% | 10% | runtime accept создаёт deal projection; `/deals/[id]` показывает clean timeline; нужен cross-screen runtime hydration сделки |
| P0-05 | LogisticsRequest из Deal | 82% | 18% | экран заявки получил lifecycle actions: отправить, просмотрено, предложить условия; нужен runtime command layer |
| P0-06 | LogisticsQuote | 78% | 22% | интерактивное предложение перевозчика есть: ставка, ТС, водитель, ETA, выбор/отклонение; нужен backend/runtime persistence |
| P0-07 | Trip из LogisticsQuote | 80% | 20% | выбор предложения создаёт рейс в UI; `/logistics/trips` подключён к trip context; dynamic `[tripId]` ещё не создан |
| P0-08 | Очистить внешний UI от technical terms | 74% | 26% | scanner + visible-copy e2e gate есть; logistics lifecycle не выводит technical copy |
| P0-09 | Убрать AI из внешнего DOM | 10% | 90% | не закрыто; старый AI route остаётся |
| P0-10 | Закрыть водительский RBAC | 94% | 6% | buyer sealed-mode + driver/logistics/elevator/lab + bank/investor gates есть |
| P0-11 | Mobile release-gates | 76% | 24% | 18 viewports + overflow + all 11 P0 routes + screenshot-capture smoke; pixel baseline ещё нет |
| P0-12 | Убрать hardcoded KPI | 44% | 56% | часть buyer/bank/logistics-safe слоя очищена; старые KPI ещё есть в других контурах |
| P0-13 | Связать документы с деньгами | 82% | 18% | release safety route подключён и включён в cross-screen smoke; нужен runtime link из конкретной сделки |
| P0-14 | Data consistency tests | 84% | 16% | unit consistency + runtime API + cross-screen smoke + logistics action smoke |

Средний P0 прогресс: 83%.

## P1 backlog

| ID | Задача | Готово | Осталось |
|---|---|---:|---:|
| P1-01 | Seller bid comparison | 80% | 20% |
| P1-02 | Buyer bid status UX | 62% | 38% |
| P1-03 | Rejection reasons | 78% | 22% |
| P1-04 | Change request после акцепта | 0% | 100% |
| P1-05 | Logistics inbox | 65% | 35% |
| P1-06 | Carrier assignment | 55% | 45% |
| P1-07 | Offline queue field roles | 20% | 80% |
| P1-08 | Metric passport investor | 10% | 90% |
| P1-09 | Единый lexicon file | 10% | 90% |
| P1-10 | Mobile table-to-card system | 45% | 55% |
| P1-11 | Screenshot capture smoke | 45% | 55% |
| P1-12 | Bid lifecycle UI actions | 70% | 30% |
| P1-13 | Runtime bid command/event layer | 55% | 45% |
| P1-14 | Cross-screen execution smoke | 45% | 55% |
| P1-15 | Logistics lifecycle UI actions | 60% | 40% |

Средний P1 прогресс: 35%.

## Release-gates

| Gate | Готово | Осталось | Комментарий |
|---|---:|---:|---|
| Forbidden DOM terms scanner | 74% | 26% | функция, unit-test, visible-copy e2e и bank/runtime/logistics route cleanup есть |
| RBAC DOM tests | 84% | 16% | buyer sealed-mode + driver/logistics/elevator/lab + bank/investor smoke |
| Bid lifecycle tests | 90% | 10% | unit covered + clickable UI smoke + runtime API smoke + negative gates |
| Deal creation tests | 86% | 14% | unit covered + runtime accept creates deal projection + cross-screen smoke |
| Logistics lifecycle tests | 82% | 18% | unit covered + clickable logistics action smoke: request → quote → trip |
| Money release safety tests | 86% | 14% | unit covered + bank release route + cross-screen smoke |
| Mobile screenshot tests | 45% | 55% | screenshot-capture smoke есть для ключевых mobile routes; сохранённых baseline-снимков нет |
| Dark/light screenshot tests | 50% | 50% | screenshot-capture smoke есть для light/dark на ключевых routes; pixel diff baseline нет |
| No horizontal scroll test | 80% | 20% | все 18 viewports по всем 11 P0 routes |
| Console clean test | 70% | 30% | runtime supplemental gates + API/cross-screen/logistics action smoke; полный browser console pass ещё не закрыт |
| Data consistency test | 84% | 16% | unit consistency + runtime API + cross-screen + logistics action smoke |
| Visual regression test | 50% | 50% | visual smoke + screenshot-capture smoke есть; diff baseline нет |
| Keyboard navigation test | 64% | 36% | bid/logistics action buttons есть; полноценный keyboard flow ещё не доказан |
| Focus visible test | 45% | 55% | есть фокусируемые действия; полноценный focus-visible стиль ещё не доказан |
| Touch target size test | 55% | 45% | driver actions + bid/logistics lifecycle buttons min-height 44px |
| Role visibility matrix test | 94% | 6% | unit matrix + DOM/API gates for buyer/driver/logistics/elevator/lab/bank/investor |
| Vercel preview deploy gate | 100% | 0% | latest code SHA green across canonical-web/demo-api/demo-api-ovdc/demo-landing |

Средний release-gates прогресс: 83%.

## Подключённые route-блоки

| Route | Статус |
|---|---|
| `/platform-v7/lots` | подключено |
| `/platform-v7/buyer` | подключено к buyer-safe lifecycle screen |
| `/platform-v7/seller` | подключено |
| `/platform-v7/logistics/requests` | подключено к logistics lifecycle screen |
| `/platform-v7/logistics/trips` | подключено к trip lifecycle screen |
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

Последний проверенный code SHA: `736685cb3c84ed197955ada7e12abb744014ec86`.

Статус Vercel по SHA `736685cb3c84ed197955ada7e12abb744014ec86`:

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
13. Добавлен `LogisticsLifecycleScreens.tsx`.
14. `/platform-v7/logistics/requests` получил действия: отправить в логистику, отметить просмотр, предложить условия, выбрать/отклонить предложение.
15. `/platform-v7/logistics/trips` переведён на trip lifecycle screen.
16. Добавлен clickable smoke `platform-v7-logistics-lifecycle-actions.spec.ts`.
17. Visual smoke выровнен под новый lifecycle UI.

## Ограничения и blockers

1. Runtime store пока server-side in-memory, не durable DB/event-store.
2. Logistics lifecycle пока client-demo state, не runtime command/event layer.
3. State может сбрасываться при restart/deploy/serverless cold start.
4. Dynamic route `/platform-v7/logistics/trips/[tripId]` не создан: запись файла с `[tripId]` была заблокирована инструментом.
5. Обновление `platform-v7-a11y-runtime-smoke.spec.ts` было заблокировано инструментом записи, поэтому ранее добавлен отдельный `platform-v7-runtime-supplemental.spec.ts`.
6. Локальный запуск `typecheck/test/build` из этого интерфейса не выполнялся.
7. PR отстаёт от актуального `main`; перед merge нужен rebase/update branch.
8. Screenshot gate пока capture-only, без сохранённого pixel-diff baseline.
9. AI route/external DOM вопрос не закрыт.

## Следующий проход

1. Перевести logistics lifecycle actions на runtime command/event layer.
2. Закрыть dynamic trip detail route `/platform-v7/logistics/trips/[tripId]`.
3. Добавить rollback/error states в UI для bid/logistics command failures.
4. Добавить durable persistence для bid/logistics commands/events или адаптер к существующему runtime command API.
