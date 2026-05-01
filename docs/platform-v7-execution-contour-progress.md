# Platform-v7 execution contour progress

Дата фиксации: 2026-05-01
Статус: controlled pilot / demo contour, не production-ready.

## Общий прогресс

| Блок | Готово | Осталось | Статус |
|---|---:|---:|---|
| P0 backlog | 90% | 10% | bid/logistics runtime layer + rollback state + persistence passport + internal assistant DOM gate + trip detail rewrite + green Vercel preview |
| P1 backlog | 43% | 57% | начат UX/RBAC/mobile/a11y/finance/visual/runtime/error-state/persistence-passport/internal-gate/deep-link слой |
| P2 backlog | 5% | 95% | почти не начат |
| Release-gates | 90% | 10% | unit/mobile/visual/DOM role/finance/runtime/API/cross-screen/logistics/persistence/internal/deep-link gates |
| Полное ТЗ | 67% | 33% | сильный P0-костяк, не финальный продукт |

## Что закрыто в последнем проходе

1. `42906c829f65a3d0e425dd836b2aca5d098d7819` стал green по всем 4 Vercel preview.
2. В `next.config.mjs` добавлен rewrite для deep-link рейса.
3. Deep-link `/platform-v7/logistics/trips/TR-2041` ведёт на рабочий экран рейса.
4. Добавлен `platform-v7-trip-detail-rewrite.spec.ts`.
5. Gate проверяет, что deep-link рейса показывает TR-2041, DL-9116, LR-2041, GPS, фото, пломбу и документы.
6. Динамическая папка не создана из-за блокировки инструмента, но пользовательский deep-link для пилота закрыт через rewrite.

## Ограничения

1. Runtime stores пока server-side in-memory, не durable DB/event-store.
2. State может сбрасываться при restart/deploy/serverless cold start.
3. Детальная страница рейса закрыта rewrite-обходом, а не полноценной динамической страницей.
4. Local `typecheck/test/build` из этого интерфейса не выполнялся.
5. PR остаётся draft.

## Следующий проход

1. Расширить visible forbidden terms gate для старого shell и спорных routes.
2. Добавить production persistence adapter только после выбора реального хранилища.
3. Усилить mobile screenshot baseline и console-clean gate.
