# Platform-v7 execution contour progress

Дата фиксации: 2026-05-01
Статус: controlled pilot / demo contour, не production-ready.

## Общий прогресс

| Блок | Готово | Осталось | Статус |
|---|---:|---:|---|
| P0 backlog | 88% | 12% | bid/logistics runtime layer + rollback state + persistence passport + green Vercel preview |
| P1 backlog | 41% | 59% | начат UX/RBAC/mobile/a11y/finance/visual/runtime/error-state/persistence-passport слой |
| P2 backlog | 5% | 95% | почти не начат |
| Release-gates | 88% | 12% | unit/mobile/visual/DOM role/finance/runtime/API/cross-screen/logistics/persistence gates |
| Полное ТЗ | 65% | 35% | сильный P0-костяк, не финальный продукт |

## Что закрыто в последнем проходе

1. `ce4c66add345d6da42274d93642b646a8acfffd9` стал green по всем 4 Vercel preview.
2. Добавлен `runtime-persistence-passport.ts`.
3. Bid runtime API отдаёт persistence passport.
4. Logistics runtime API отдаёт persistence passport.
5. Добавлен `platform-v7-runtime-persistence-passport.spec.ts`.
6. E2E-gate фиксирует честный статус runtime layer:
   - `server_memory`;
   - `durable: false`;
   - `productionReady: false`;
   - reset risk: restart/deploy;
   - controlled pilot memory store.

## Ограничения

1. Runtime stores пока server-side in-memory, не durable DB/event-store.
2. State может сбрасываться при restart/deploy/serverless cold start.
3. Детальная страница рейса ещё не закрыта из-за блокировки инструмента записи.
4. Local `typecheck/test/build` из этого интерфейса не выполнялся.
5. PR остаётся draft.

## Следующий проход

1. Закрыть AI route/external DOM question.
2. Повторить детальную страницу рейса через другой безопасный механизм, если инструмент позволит.
3. Добавить production persistence adapter только после выбора реального хранилища.
