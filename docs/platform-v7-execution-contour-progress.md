# Platform-v7 execution contour progress

Дата фиксации: 2026-05-01
Статус: controlled pilot / demo contour, не production-ready.

## Общий прогресс

| Блок | Готово | Осталось | Статус |
|---|---:|---:|---|
| P0 backlog | 91% | 9% | bid/logistics runtime layer + rollback state + persistence passport + internal/forbidden DOM gates + trip detail rewrite + green Vercel preview |
| P1 backlog | 44% | 56% | начат UX/RBAC/mobile/a11y/finance/visual/runtime/error-state/persistence-passport/internal-gate/deep-link/forbidden-copy слой |
| P2 backlog | 5% | 95% | почти не начат |
| Release-gates | 91% | 9% | unit/mobile/visual/DOM role/finance/runtime/API/cross-screen/logistics/persistence/internal/deep-link/forbidden-copy gates |
| Полное ТЗ | 68% | 32% | сильный P0-костяк, не финальный продукт |

## Что закрыто в последнем проходе

1. `40e7d761b044b9bf261ca40a38ff46a2d225d80a` стал green по всем 4 Vercel preview.
2. Добавлен `platform-v7-expanded-forbidden-terms-gate.spec.ts`.
3. Gate расширен на старый shell и спорные маршруты platform-v7 / platform-v7r.
4. Проверяются visible forbidden terms: Control Tower, callback/callbacks, evidence-first, release, hold, owner, blocker, sandbox dispatch, Action handoff, domain-core, runtime, idempotency, guard, legacy, mock, debug, test user, GigaChat, assistant, AI.
5. Это gate на внешний DOM: если термин реально появится в видимом тексте route, тест должен упасть.

## Ограничения

1. Runtime stores пока server-side in-memory, не durable DB/event-store.
2. State может сбрасываться при restart/deploy/serverless cold start.
3. Детальная страница рейса закрыта rewrite-обходом, а не полноценной динамической страницей.
4. Expanded forbidden terms gate пока добавлен как проверка; если CI/e2e выявит конкретные старые routes с утечками, нужен точечный cleanup copy.
5. Local `typecheck/test/build` из этого интерфейса не выполнялся.
6. PR остаётся draft.

## Следующий проход

1. Усилить mobile screenshot baseline.
2. Усилить console-clean gate.
3. Добавить production persistence adapter только после выбора реального хранилища.
