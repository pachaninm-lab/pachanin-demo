# Platform-v7 execution contour progress

Дата фиксации: 2026-05-01
Статус: controlled pilot / demo contour, не production-ready.

## Общий прогресс

| Блок | Готово | Осталось | Статус |
|---|---:|---:|---|
| P0 backlog | 60% | 40% | доменный P0-костяк + route/UI + buyer/driver RBAC gates |
| P1 backlog | 23% | 77% | начат базовый UX/RBAC/mobile/a11y слой |
| P2 backlog | 5% | 95% | почти не начат |
| Release-gates | 51% | 49% | unit-gates + mobile/forbidden/runtime/a11y/buyer-RBAC smoke gates |
| Полное ТЗ | 36% | 64% | сильный P0-костяк, не финальный продукт |

## P0 backlog

| ID | Задача | Готово | Осталось | Комментарий |
|---|---|---:|---:|---|
| P0-01 | Bid object и lifecycle | 80% | 20% | типы и функции есть; нужен UI submit/update/withdraw |
| P0-02 | Лента ставок на лоте | 55% | 45% | reusable screen есть; dynamic route `/lots/[lotId]/bids` не подключён |
| P0-03 | Акцепт ставки | 75% | 25% | доменная функция и тест есть; нужен настоящий UI action |
| P0-04 | Deal из Bid | 80% | 20% | 1:1 экономика проверяется unit-test; нужен runtime store/persistence |
| P0-05 | LogisticsRequest из Deal | 70% | 30% | доменная функция и экран заявок есть |
| P0-06 | LogisticsQuote | 65% | 35% | доменная функция и экран предложения есть |
| P0-07 | Trip из LogisticsQuote | 70% | 30% | доменная функция и экран рейса есть |
| P0-08 | Очистить внешний UI от technical terms | 50% | 50% | scanner + visible-copy e2e gate есть для P0-страниц; старые страницы ещё надо чистить |
| P0-09 | Убрать AI из внешнего DOM | 10% | 90% | не закрыто; старый AI route остаётся |
| P0-10 | Закрыть водительский RBAC | 82% | 18% | `/driver` field shell + DOM e2e gate; нужен полный role matrix |
| P0-11 | Mobile release-gates | 52% | 48% | 18 viewports + overflow + runtime smoke + keyboard entry; screenshot baseline ещё нет |
| P0-12 | Убрать hardcoded KPI | 28% | 72% | buyer-safe экран больше не раскрывает чужие ставки/минимум продавца; старые KPI ещё есть |
| P0-13 | Связать документы с деньгами | 60% | 40% | release safety учитывает документы; нужен UI/route bank integration |
| P0-14 | Data consistency tests | 70% | 30% | unit consistency test есть; нужен полный cross-screen e2e |

Средний P0 прогресс: 60%.

## P1 backlog

| ID | Задача | Готово | Осталось |
|---|---|---:|---:|
| P1-01 | Seller bid comparison | 45% | 55% |
| P1-02 | Buyer bid status UX | 45% | 55% |
| P1-03 | Rejection reasons | 70% | 30% |
| P1-04 | Change request после акцепта | 0% | 100% |
| P1-05 | Logistics inbox | 45% | 55% |
| P1-06 | Carrier assignment | 35% | 65% |
| P1-07 | Offline queue field roles | 20% | 80% |
| P1-08 | Metric passport investor | 0% | 100% |
| P1-09 | Единый lexicon file | 10% | 90% |
| P1-10 | Mobile table-to-card system | 45% | 55% |

Средний P1 прогресс: 23%.

## Release-gates

| Gate | Готово | Осталось | Комментарий |
|---|---:|---:|---|
| Forbidden DOM terms scanner | 55% | 45% | функция, unit-test и visible-copy e2e gate есть для P0-страниц |
| RBAC DOM tests | 55% | 45% | driver DOM + buyer sealed-mode e2e; нужна полная role matrix |
| Bid lifecycle tests | 70% | 30% | unit covered; нужен UI lifecycle |
| Deal creation tests | 70% | 30% | unit covered; нужен route-level test |
| Logistics lifecycle tests | 65% | 35% | unit covered + logistics routes in e2e |
| Money release safety tests | 60% | 40% | unit covered; нужен bank route cleanup |
| Mobile screenshot tests | 15% | 85% | viewports covered; screenshots не сохраняются как baseline |
| Dark/light screenshot tests | 35% | 65% | light/dark readability smoke есть; screenshot baseline нет |
| No horizontal scroll test | 60% | 40% | все 18 viewports по P0-страницам добавлены |
| Console clean test | 45% | 55% | console/page runtime smoke gate добавлен по P0-страницам |
| Data consistency test | 70% | 30% | unit covered |
| Visual regression test | 10% | 90% | visible smoke есть; diff baseline нет |
| Keyboard navigation test | 50% | 50% | базовый Tab/focus smoke + общая keyboard-entry точка P7Page |
| Focus visible test | 40% | 60% | есть фокусируемая точка входа; полноценный focus-visible стиль ещё не доказан |
| Touch target size test | 40% | 60% | driver primary actions + P7Page keyboard-entry покрыты min 44px |
| Role visibility matrix test | 55% | 45% | driver + bid visibility + buyer sealed-mode started |

Средний release-gates прогресс: 51%.

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
| `/platform-v7/lots/[lotId]/bids` | не подключено |
| `/platform-v7/deals/[id]` | не подключено к новому timeline screen |
| `/platform-v7/bank/release-safety` | не очищено |

Route coverage по текущему P0-набору: 8 из 11 = 73%.

## Деплой текущего прохода

Каждый commit в этой ветке запускает Vercel preview deployments.

Последний проверенный SHA: `f9aaf9a6a75c4b99cd164b54be6bfe4d604ff0e1`.

Статус Vercel по SHA `f9aaf9a6a75c4b99cd164b54be6bfe4d604ff0e1`:

| Контур | Статус |
|---|---|
| `pachanin-demo-api` | success |
| `pachanin-demo-api-ovdc` | success |
| `pachanin-demo-landing` | success |
| `pachanin-canonical-web` | pending |

Production merge/deploy запрещён до зелёного `pachanin-canonical-web` и закрытия draft PR.

## Заблокированные точки текущего прохода

1. Dynamic route write для `/platform-v7/deals/[id]` был заблокирован инструментом записи.
2. Dynamic route write для `/platform-v7/lots/[lotId]/bids` был заблокирован инструментом записи.
3. Прямое обновление `/platform-v7/bank/release-safety/page.tsx` было заблокировано инструментом записи.
4. Обновление type import в `platform-v7-a11y-runtime-smoke.spec.ts` было заблокировано инструментом записи.
5. Локальный запуск `typecheck/test/build` из этого интерфейса не выполнялся.
6. PR отстаёт от актуального `main`; перед merge нужен rebase/update branch.

## Следующий проход

1. Проверить Vercel status нового progress SHA.
2. Добавить полноценную role visibility matrix для seller/logistics/bank/investor.
3. Подключить dynamic routes через допустимый путь записи или вручную.
4. Почистить старый bank route от technical terms.
5. Добавить screenshot baselines для mobile/dark-light.
6. Прогнать CI и только после зелёного CI переводить PR из draft в ready.
