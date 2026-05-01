# Platform-v7 execution contour progress

Дата фиксации: 2026-05-01
Статус: controlled pilot / demo contour, не production-ready.

## Общий прогресс

| Блок | Готово | Осталось | Статус |
|---|---:|---:|---|
| P0 backlog | 91% | 9% | bid/logistics runtime layer + rollback state + persistence passport + internal/forbidden DOM gates + trip detail rewrite + green Vercel preview |
| P1 backlog | 46% | 54% | начат UX/RBAC/mobile/a11y/finance/visual/runtime/error-state/persistence-passport/internal-gate/deep-link/forbidden-copy/screenshot/console слой |
| P2 backlog | 5% | 95% | почти не начат |
| Release-gates | 93% | 7% | unit/mobile/visual/DOM role/finance/runtime/API/cross-screen/logistics/persistence/internal/deep-link/forbidden-copy/screenshot/console-clean gates |
| Полное ТЗ | 70% | 30% | сильный P0-костяк, не финальный продукт |

## Что закрыто в последнем проходе

1. `8f068e01b8873c04910867f1ea15982bcb68bd78` стал green по всем 4 Vercel preview.
2. `platform-v7-runtime-supplemental.spec.ts` расширен с 3 до 12 маршрутов.
3. Console-clean gate теперь покрывает lots, bids, deal, bank, buyer, seller, logistics, trip, trip deep-link, driver, elevator, lab.
4. Gate ловит `console.error`, `pageerror`, failed runtime requests и отсутствие keyboard focus entry.
5. Deep-link рейса включён в console-clean gate.

## Ограничения

1. Runtime stores пока server-side in-memory, не durable DB/event-store.
2. State может сбрасываться при restart/deploy/serverless cold start.
3. Детальная страница рейса закрыта rewrite-обходом, а не полноценной динамической страницей.
4. Screenshot gate остаётся smoke/capture gate, не pixel-diff visual regression baseline.
5. Console-clean gate расширен, но локальный полный Playwright-run из этого интерфейса не выполнялся.
6. Local `typecheck/test/build` из этого интерфейса не выполнялся.
7. PR остаётся draft.

## Следующий проход

1. Добавить production persistence adapter только после выбора реального хранилища.
2. Продолжить visual polish / pixel baseline отдельным блоком.
3. Подготовить PR к rebase/update branch перед merge.
