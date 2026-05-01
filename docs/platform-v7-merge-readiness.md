# Platform-v7 merge readiness

Дата фиксации: 2026-05-01
PR: #412
Branch: `feat/platform-v7-execution-contour-p0`
Статус: draft, controlled pilot / demo contour, не production-ready.

## Текущее состояние PR

- PR открыт.
- PR draft.
- PR mergeable по GitHub metadata.
- Последний проверенный head: `5ba2964eee5b284f7c924dbaf86a7ff68c3e99b8`.
- Vercel по head green во всех 4 preview-контурах:
  - `pachanin-demo-api`
  - `pachanin-demo-api-ovdc`
  - `pachanin-demo-landing`
  - `pachanin-canonical-web`

## Расхождение с main

Сравнение `main` → `feat/platform-v7-execution-contour-p0`:

- branch ahead by 101+ commits;
- branch behind by 27 commits;
- status: diverged.

Сравнение `feat/platform-v7-execution-contour-p0` → `main` показало, что 27 коммитов в `main` затрагивают только `apps/landing/*`:

- `apps/landing/app/brand-logo.css`
- `apps/landing/app/components/FortyEightHourResult.tsx`
- `apps/landing/app/components/HeaderLogo.tsx`
- `apps/landing/app/components/LandingHero.tsx`
- `apps/landing/app/components/LossMap.tsx`
- `apps/landing/app/components/PilotLeadForm.tsx`
- `apps/landing/app/components/PremiumMockups.tsx`
- `apps/landing/app/components/RoleEntry.tsx`
- `apps/landing/app/components/StickyCTA.tsx`
- `apps/landing/app/globals.css`
- `apps/landing/app/page.tsx`

## Риск update branch

Риск прямого конфликта по platform-v7 низкий, потому что PR #412 в основном меняет:

- `apps/web/app/platform-v7/*`
- `apps/web/components/platform-v7/*`
- `apps/web/lib/platform-v7/*`
- `apps/web/tests/*`
- `docs/*`

А актуальный `main` меняет landing-контур.

Но update/rebase всё равно должен быть отдельным controlled step, потому что:

1. PR содержит 100+ commits;
2. PR уже diverged;
3. после update branch нужно заново подтвердить Vercel и tests;
4. production merge без полного CI запрещён.

## Controlled update branch sequence

```bash
git fetch origin
git checkout feat/platform-v7-execution-contour-p0
git status --short
git merge --no-ff origin/main
```

Если conflicts отсутствуют:

```bash
npm --prefix apps/web run typecheck
npm --prefix apps/web test
npx playwright test apps/web/tests/e2e/platform-v7-*.spec.ts
```

Если всё green:

```bash
git push origin feat/platform-v7-execution-contour-p0
```

После push:

1. дождаться 4 Vercel preview checks;
2. открыть PR #412;
3. проверить changed files;
4. убедиться, что landing-only changes из main не затронули `apps/web`;
5. только потом переводить draft в ready for review.

## Merge-readiness checklist

Перед переводом PR из draft в ready for review:

- [ ] Update/rebase branch from current `main`.
- [ ] Confirm no unexpected changes in `apps/web` from merge.
- [ ] Confirm all 4 Vercel preview checks green after update.
- [ ] Run typecheck.
- [ ] Run unit tests.
- [ ] Run Playwright suite.
- [ ] Confirm driver cannot see money, bank, bids, investor.
- [ ] Confirm logistics cannot see grain bid economics or bank reserve.
- [ ] Confirm buyer sealed-mode hides competing bids.
- [ ] Confirm forbidden visible terms gate passes.
- [ ] Confirm internal assistant DOM gate passes.
- [ ] Confirm trip deep-link rewrite still works.
- [ ] Confirm runtime persistence remains honestly marked non-durable unless DB adapter is implemented.

## Не закрыто для production-ready

1. Runtime stores are server-side in-memory.
2. There is no durable DB/event-store.
3. Runtime state can reset on restart/deploy/serverless cold start.
4. Trip detail page uses rewrite fallback, not a full dynamic route page.
5. Screenshot baseline is smoke/capture, not pixel-diff visual regression.
6. Production auth/RBAC is not proven in this PR.
7. Real integrations/contracts/accesses are not proven in this PR.

## Рекомендация

Do not merge as production-ready.

Safe status for review: strong controlled-pilot / demo-contour foundation.

Next safe operational step:

1. update branch from `main`;
2. run full CI;
3. if green, convert draft to ready for review;
4. only after real persistence decision start DB/event-store adapter work.
