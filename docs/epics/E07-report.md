# Epic 07: Onboarding & Compliance Readiness — progress report

## Status

E07 is complete at the foundation/source-of-truth level. Runtime hookup into registration, profile, onboarding and action surfaces is intentionally blocked until staged visible patching is done safely.

## Completed

- Added `apps/web/lib/platform-v7/onboarding-kyc.ts`.
- Added `apps/web/lib/platform-v7/onboarding-documents.ts`.
- Added `apps/web/lib/platform-v7/onboarding-access-gate.ts`.
- Added `apps/web/lib/platform-v7/onboarding-compliance-queue.ts`.
- Added `apps/web/lib/platform-v7/onboarding-risk-score.ts`.
- Added unit coverage for KYC, document readiness, access gate, compliance queue and risk score.

## Covered acceptance areas

- Registration no longer equals deal access at the model level.
- KYC/AML gate separates not started, incomplete, manual review, approved, restricted and rejected states.
- Company actions are blocked until KYC and role documents are ready.
- Seller lot creation requires approved seller KYC and required seller documents.
- Buyer purchase request creation requires approved buyer KYC and required buyer documents.
- Money receiving requires approved KYC, verified bank account and verified signer authority.
- Role documents are modeled per seller, buyer, carrier, elevator, lab and bank operator.
- Expired and missing documents block KYC submission.
- Compliance queue exposes clear, review, blocked and restricted statuses.
- Risk score blocks auto-approval for critical AML/sanctions and high-risk profiles.
- Runtime must remain honest: no live KYC/AML claim until real provider integration exists.

## Merged PRs

- #142 — onboarding KYC model and tests.
- #143 — onboarding documents model and tests.
- #144 — onboarding access gate model and tests.
- #145 — onboarding compliance queue model and tests.
- #146 — onboarding risk score model and tests.

## Remaining blocker

Issue #147 blocks final runtime hookup into:

- `apps/web/app/platform-v7/register/page.tsx`.
- `apps/web/app/platform-v7/profile/page.tsx`.
- possible `/platform-v7/onboarding` route.
- role action surfaces for lots, purchase requests, deals, money, lab results and transport documents.

Reason: runtime hookup touches user access, transaction actions, money permissions, role surfaces and compliance claims. It must be staged and fail-closed, not patched as a broad rewrite.

## Safe next step

Start with the smallest visible patch:

1. Add an onboarding status panel to `platform-v7/register/page.tsx` or create `/platform-v7/onboarding`.
2. Import `platformV7OnboardingKycModel()` and `platformV7OnboardingDocumentsModel()`.
3. Render one sandbox company state with blockers and next action.
4. Mark the block as sandbox/pre-integration, not live KYC.
5. Do not change auth/session behavior.
6. Do not unlock lot/deal/money actions yet.
7. Run `pnpm typecheck && pnpm test && pnpm build`.

Then migrate one block per PR:

1. KYC status panel → `onboarding-kyc`.
2. Document readiness → `onboarding-documents`.
3. Action guard → `onboarding-access-gate`.
4. Operator compliance queue → `onboarding-compliance-queue`.
5. Risk panel → `onboarding-risk-score`.

## Runtime impact so far

Low-risk. Runtime onboarding/register/profile UI has not been changed yet. E07 foundation is ready for staged hookup.

## Known issues

- Final E07 acceptance cannot be marked done until issue #147 is resolved.
- E06 still has issue #140 for bank runtime hookup.
- E05 still has issue #131 for deal workspace runtime hookup.
- E04 still has issue #121 for investor/demo runtime hookup.
- E03 still has issue #111 for runtime action button hookup.
- E02 still has issue #100 for final `AppShellV3` hookup.
- E01 still has issue #91 for remaining large runtime files.

## Current estimate

- E07 foundation/source-of-truth: complete.
- E07 runtime onboarding/compliance hookup: blocked.
- Overall E07 progress: about 98% complete.
