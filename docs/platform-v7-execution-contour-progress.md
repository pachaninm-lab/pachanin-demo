# Platform-v7 execution contour progress

Дата фиксации: 2026-05-01
Статус: controlled pilot / demo contour, не production-ready.

## Общий прогресс

| Блок | Готово | Осталось | Статус |
|---|---:|---:|---|
| P0 backlog | 58% | 42% | доменный P0-костяк + часть route/UI + unit/e2e gates |
| P1 backlog | 21% | 79% | начат базовый UX/RBAC/mobile слой |
| P2 backlog | 5% | 95% | почти не начат |
| Release-gates | 46% | 54% | unit-gates + mobile/forbidden/runtime/a11y smoke gates |
| Полное ТЗ | 34% | 66% | сильный P0-костяк, не финальный продукт |

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
| P0-10 | Закрыть водительский RBAC | 80% | 20% | `/driver` field shell + DOM e2e gate; нужен полный role matrix |
| P0-11 | Mobile release-gates | 50% | 50% | 18 viewports + overflow + runtime smoke; screenshot baseline ещё нет |
| P0-12 | Убрать hardcoded KPI | 25% | 75% | новый контур считает суммы из bid; старые KPI ещё есть |
| P0-13 | Связать документы с деньгами | 60% | 40% | release safety учитывает документы; нужен UI/route bank integration |
| P0-14 | Data consistency tests | 70% | 30% | unit consistency test есть; нужен полный cross-screen e2e |

Средний P0 прогресс: 58%.

## P1 backlog

| ID | Задача | Готово | Осталось |
|---|---|---:|---:|
| P1-01 | Seller bid comparison | 45% | 55% |
| P1-02 | Buyer bid status UX | 35% | 65% |
| P1-03 | Rejection reasons | 70% | 30% |
| P1-04 | Change request после акцепта | 0% | 100% |
| P1-05 | Logistics inbox | 45% | 55% |
| P1-06 | Carrier assignment | 35% | 65% |
| P1-07 | Offline queue field roles | 20% | 80% |
| P1-08 | Metric passport investor | 0% | 100% |
| P1-09 | Единый lexicon file | 10% | 90% |
| P1-10 | Mobile table-to-card system | 45% | 55% |

Средний P1 прогресс: 21%.

## Release-gates

| Gate | Готово | Осталось | Комментарий |
|---|---:|---:|---|
| Forbidden DOM terms scanner | 55% | 45% | функция, unit-test и visible-copy e2e gate есть для P0-страниц |
| RBAC DOM tests | 45% | 55% | driver DOM covered; нужна полная role matrix |
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
| Keyboard navigation test | 35% | 65% | базовый Tab/focus smoke добавлен |
| Focus visible test | 25% | 75% | проверяется наличие фокусируемого элемента; полноценный focus-visible стиль ещё не доказан |
| Touch target size test | 35% | 65% | driver primary actions covered |
| Role visibility matrix test | 45% | 55% | driver + bid visibility started |

Средний release-gates прогресс: 46%.

## Подключённые route-блоки

| Route | Статус |
|---|---|
| `/platform-v7/lots` | подключено |
| `/platform-v7/buyer` | подключено |
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

Каждый commit в этой ветке запускает Vercel preview deployments. Последний проверенный SHA: `af9f86fb530446f9a07c77e6edcf9fa764b0ede8`.

На момент фиксации статусы Vercel были `pending`, поэтому production merge/deploy запрещён до зелёной проверки.

## Заблокированные точки текущего прохода

1. Dynamic route write для `/platform-v7/deals/[id]` был заблокирован инструментом записи.
2. Dynamic route write для `/platform-v7/lots/[lotId]/bids` был заблокирован инструментом записи.
3. Прямое обновление `/platform-v7/bank/release-safety/page.tsx` было заблокировано инструментом записи.
4. Локальный запуск `typecheck/test/build` из этого интерфейса не выполнялся.
5. PR отстаёт от актуального `main`; перед merge нужен rebase/update branch.

## Следующий проход

1. Закрыть focusable-action gap на страницах elevator/lab/logistics, если e2e покажет отсутствие keyboard target.
2. Подключить dynamic routes через допустимый путь записи или вручную.
3. Почистить старый bank route от technical terms.
4. Прогнать CI и проверить Vercel preview deployments.
5. Только после зелёного CI переводить PR из draft в ready.
