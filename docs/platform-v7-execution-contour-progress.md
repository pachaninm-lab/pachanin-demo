# Platform-v7 execution contour progress

Дата фиксации: 2026-05-01
Статус: controlled pilot / demo contour, не production-ready.

## Общий прогресс

| Блок | Готово | Осталось | Статус |
|---|---:|---:|---|
| P0 backlog | 91% | 9% | bid/logistics runtime layer + rollback state + persistence passport + internal/forbidden DOM gates + trip detail rewrite + green Vercel preview |
| P1 backlog | 45% | 55% | начат UX/RBAC/mobile/a11y/finance/visual/runtime/error-state/persistence-passport/internal-gate/deep-link/forbidden-copy/screenshot слой |
| P2 backlog | 5% | 95% | почти не начат |
| Release-gates | 92% | 8% | unit/mobile/visual/DOM role/finance/runtime/API/cross-screen/logistics/persistence/internal/deep-link/forbidden-copy/screenshot gates |
| Полное ТЗ | 69% | 31% | сильный P0-костяк, не финальный продукт |

## Что закрыто в последнем проходе

1. `ecac65804ad8ae740f95c2407c0e8868b4c33626` стал green по всем 4 Vercel preview.
2. `platform-v7-screenshot-capture-smoke.spec.ts` расширен с 8 до 14 baseline cases.
3. Добавлены проверки на 320 / 390 / 430 / 768 / 1366 viewport.
4. Покрыты light и dark режимы.
5. Покрыты ключевые роли и маршруты: lots, buyer, seller, bids, deal, logistics, trip deep-link, driver, elevator, lab, bank.
6. Каждый screenshot baseline теперь проверяет meaningful text, обязательные фрагменты, отсутствие horizontal overflow и непустой screenshot payload.

## Ограничения

1. Runtime stores пока server-side in-memory, не durable DB/event-store.
2. State может сбрасываться при restart/deploy/serverless cold start.
3. Детальная страница рейса закрыта rewrite-обходом, а не полноценной динамической страницей.
4. Screenshot gate остаётся smoke/capture gate, не pixel-diff visual regression baseline.
5. Local `typecheck/test/build` из этого интерфейса не выполнялся.
6. PR остаётся draft.

## Следующий проход

1. Усилить console-clean gate.
2. Добавить production persistence adapter только после выбора реального хранилища.
3. Продолжить visual polish / pixel baseline отдельным блоком.
