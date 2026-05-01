# Platform-v7 execution contour progress

Дата фиксации: 2026-05-01
Статус: controlled pilot / demo contour, не production-ready.

## Общий прогресс

| Блок | Готово | Осталось | Статус |
|---|---:|---:|---|
| P0 backlog | 87% | 13% | bid/logistics runtime layer + bid/logistics rollback state + green Vercel preview |
| P1 backlog | 40% | 60% | начат UX/RBAC/mobile/a11y/finance/visual/runtime/error-state слой |
| P2 backlog | 5% | 95% | почти не начат |
| Release-gates | 87% | 13% | unit/mobile/visual/DOM role/finance/runtime/API/cross-screen/logistics gates |
| Полное ТЗ | 64% | 36% | сильный P0-костяк, не финальный продукт |

## Что закрыто в последнем проходе

1. `b84998117b4752b2040fcaa1bfa389c473448588` стал green по всем 4 Vercel preview.
2. В `platform-v7-logistics-runtime-api.spec.ts` добавлена проверка failed-команды.
3. Failed logistics command теперь тестом обязан сохранять последнюю серверную projection.
4. В `LogisticsLifecycleScreens.tsx` добавлен rollback/error state.
5. Command FAILED показывает отдельный блок ошибки.
6. Network error показывает отдельный блок ошибки.
7. UI не делает optimistic-перезапись без server projection.
8. Состояние логистики остаётся по последней серверной версии.

## Ограничения

1. Runtime stores пока server-side in-memory, не durable DB/event-store.
2. State может сбрасываться при restart/deploy/serverless cold start.
3. Детальная страница рейса ещё не закрыта из-за блокировки инструмента записи.
4. Local `typecheck/test/build` из этого интерфейса не выполнялся.
5. PR остаётся draft.

## Следующий проход

1. Подключить durable persistence или адаптер к существующему runtime command API.
2. Закрыть AI route/external DOM question.
3. Повторить детальную страницу рейса через другой безопасный механизм, если инструмент позволит.
