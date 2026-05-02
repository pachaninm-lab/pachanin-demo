# Platform V7 Hardening Quality Gates

## Scope

This document defines the production-hardening gates for Platform V7 without real external integrations.

Where a bank, FGIS, EDO, ETRN, GPS, or lab connection is needed, the platform must show a clear test-mode simulation and must not claim live execution.

## Priority routes

The following routes must stay green on desktop and mobile:

- `/platform-v7`
- `/platform-v7/seller`
- `/platform-v7/buyer`
- `/platform-v7/logistics`
- `/platform-v7/driver/field`
- `/platform-v7/elevator`
- `/platform-v7/lab`
- `/platform-v7/bank`
- `/platform-v7/control-tower`
- `/platform-v7/disputes`
- `/platform-v7/connectors`
- `/platform-v7/investor`

## Mobile viewports

Required mobile checks:

- 390 x 844
- 375 x 667
- 414 x 896
- 768 x 1024

Required desktop check:

- 1440 x 900

## Automated gates already added

The following gates now exist as code:

- Route screen gate for priority routes.
- Mobile overflow gate at 390px for priority routes.
- Forbidden-copy gate for maturity and internal terms.
- Driver field-shell leakage smoke.
- EvidencePack metadata smoke.
- DocumentsMatrix metadata smoke.
- Manual action reason smoke on Control Tower.
- Role route policy unit coverage.
- Metadata slots unit coverage.
- Manual action reason unit coverage.

## Visual regression gate

A route fails the gate if any of these appear:

- horizontal overflow;
- primary action hidden or missing;
- sticky element overlaps content;
- role summary clipped;
- table unusable on mobile;
- driver field shell shows non-driver content;
- bank page presents test-mode data as real external execution;
- dispute evidence hides missing data instead of marking it as unavailable;
- money totals appear as independent duplicate sums.

## Lighthouse gate

Initial hardening target:

- Performance: not lower than current baseline;
- Accessibility: 95+ target;
- Best Practices: 95+ target;
- CLS: 0.1 or lower target;
- LCP: 2.5s or lower target;
- INP: 200ms or lower target.

If the current baseline is below target, the route must not regress further.

## Manual QA checklist

For each priority route, verify:

1. The page returns 200.
2. The page has a clear H1 or primary screen title.
3. The page has one obvious primary action or next step.
4. Internal development wording is not shown to the user.
5. Test-mode systems are clearly marked as simulated.
6. The route has no horizontal overflow at 390px.
7. The route is readable on mobile without zooming.
8. Critical money, document, dispute, route, or role statuses are visible above the fold where relevant.
9. Role-specific pages do not expose unrelated controls.
10. `apps/landing` is not part of Platform V7 changes.

## Remaining implementation work

- Add automated screenshot capture for priority routes.
- Add no-regression comparison for screenshots.
- Add Lighthouse baseline script or CI job.
- Expand mobile overflow checks to 375, 414, 768, and 1440 viewports.
- Add route policy UI hints beyond the driver field route.
- Expand action-feedback strip into old-button flows without real external integrations.
- Connect manual action reasons to actual operator actions step by step.
- Add a final benchmark document against B2B/agro references.

## Current status

The hardening gates are partially automated.

The platform now has automated protection for route availability, first-screen presence, mobile overflow at 390px, forbidden copy, driver leakage, evidence metadata, document metadata, and manual action reasons.

The remaining gates should be added in small, reviewable PRs without rewriting the architecture, adding real integrations, or touching `apps/landing`.
