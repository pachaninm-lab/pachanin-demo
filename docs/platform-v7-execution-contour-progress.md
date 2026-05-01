# Platform-v7 execution contour progress

Дата фиксации: 2026-05-01
Статус: controlled pilot / demo contour, не production-ready.

## Общий прогресс

| Блок | Готово | Осталось | Статус |
|---|---:|---:|---|
| P0 backlog | 89% | 11% | bid/logistics runtime layer + rollback state + persistence passport + internal assistant DOM gate + green Vercel preview |
| P1 backlog | 42% | 58% | начат UX/RBAC/mobile/a11y/finance/visual/runtime/error-state/persistence-passport/internal-gate слой |
| P2 backlog | 5% | 95% | почти не начат |
| Release-gates | 89% | 11% | unit/mobile/visual/DOM role/finance/runtime/API/cross-screen/logistics/persistence/internal gates |
| Полное ТЗ | 66% | 34% | сильный P0-костяк, не финальный продукт |

## Что закрыто в последнем проходе

1. `2ec964f9076ee864aaa5a308a9f16868938e2275` стал green по всем 4 Vercel preview.
2. Добавлен `platform-v7-internal-assistant-dom-gate.spec.ts`.
3. Gate проверяет внешние маршруты platform-v7.
4. Во внешнем DOM запрещены `.pc-giga`, internal assistant test id и видимые assistant/AI/ИИ-строки.
5. Старый shell identified as risk area, но текущие execution-contour routes покрыты отдельным DOM-gate.

## Ограничения

1. Runtime stores пока server-side in-memory, не durable DB/event-store.
2. State может сбрасываться при restart/deploy/serverless cold start.
3. Детальная страница рейса ещё не закрыта из-за блокировки инструмента записи.
4. Local `typecheck/test/build` из этого интерфейса не выполнялся.
5. PR остаётся draft.

## Следующий проход

1. Повторить детальную страницу рейса через другой безопасный механизм, если инструмент позволит.
2. Добавить production persistence adapter только после выбора реального хранилища.
3. Расширить visible forbidden terms gate для старого shell и спорных routes.
