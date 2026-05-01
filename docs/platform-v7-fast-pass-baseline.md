# Platform V7 fast-pass baseline

## Scope

Рабочая ветка: `feat/platform-v7-fast-safe-world-class-execution-ux`.

PR-1 фиксирует baseline и quality-gates для дальнейших маленьких PR. Этот проход не переписывает platform-v7, не меняет продуктовую логику экранов и не трогает `apps/landing`.

## Production URL

Текущий внешний маршрут для проверки: `https://pachanin-web.vercel.app/platform-v7/`.

Deployment context в этом PR не менялся. Production URL / alias не затрагивались.

## P0 smoke routes

Текущий зелёный baseline фиксируется для маршрутов:

- `/platform-v7`
- `/platform-v7/roles`
- `/platform-v7/seller`
- `/platform-v7/buyer`
- `/platform-v7/logistics`
- `/platform-v7/driver`
- `/platform-v7/elevator`
- `/platform-v7/lab`
- `/platform-v7/surveyor`
- `/platform-v7/bank`
- `/platform-v7/control-tower`
- `/platform-v7/disputes`
- `/platform-v7/compliance`
- `/platform-v7/arbitrator`
- `/platform-v7/investor`
- `/platform-v7/demo`

## Target fast-pass routes

Целевой fast-pass дополнительно держит в registry:

- `/platform-v7/driver/field`
- `/platform-v7/connectors`
- `/platform-v7/documents`

## Known baseline gaps

1. `/platform-v7/driver/field` пока не включён в P0 smoke как готовый маршрут. Текущий совместимый водительский маршрут: `/platform-v7/driver`. Целевой isolated field-shell должен быть закрыт отдельным PR.
2. Screenshots baseline в этом PR не приложен: в текущем инструментальном контуре нет локального checkout/runtime и браузерного runner. Добавлен Playwright skeleton, чтобы CI/локальный прогон мог снять и проверить поверхность дальше.
3. Forbidden-copy gate может выявить старый пользовательский UI-язык. Это намеренный no-regression gate для PR-2, а не попытка скрыть текущий долг.

## Quality gates added

- `apps/web/lib/platform-v7/route-audit.ts`
- `apps/web/tests/unit/platformV7RouteAudit.test.ts`
- `apps/web/tests/e2e/platform-v7-route-audit.spec.ts`
- `apps/web/tests/e2e/forbidden-copy.spec.ts`
- `apps/web/lib/platform-v7/role-access.ts`
- `apps/web/tests/unit/platformV7RoleLeakage.test.ts`

## No-touch confirmation

`apps/landing` не изменялся в этом PR.

## Next PR

PR-2 должен заменить `/platform-v7` на явный сценарный вход, убрать cookie-first редирект как default behavior, добавить `lexicon.ts` и начать системную замену запретного внешнего UI-языка.
