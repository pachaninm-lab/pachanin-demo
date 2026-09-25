# Public homepage and linked-page acceptance — 2026-09-05

Status: **PENDING PRODUCTION ACCEPTANCE**

This record is intentionally fail-closed. Source changes, tests, CI or screenshots from an earlier revision do not establish final acceptance. The task reaches final acceptance only after the implementation governance chain is accepted, the implementation is merged, the canonical REG.RU deployment identifies the exact deployed revision, and the deployed public surfaces pass the checks below.

## Product contract

The public experience must explain one crop-trade product in this order:

1. proposition and business outcome;
2. value for the visitor's role;
3. the ordinary seven-step Deal journey;
4. capabilities that work across that journey;
5. trust, external-system and Gekta boundaries;
6. answers to common questions;
7. registration as the clear next step.

The public role taxonomy is exactly:

- seller;
- buyer;
- logistics;
- driver;
- elevator / storage;
- laboratory;
- surveyor;
- bank / finance;
- platform employee.

This public taxonomy is explanatory only. It does not alter protected RBAC, registration role assignment, tenant isolation or cabinet routing.

The ordinary Deal journey is exactly:

1. Product and terms
2. Bidding and counterparty
3. Deal and contract
4. Logistics and delivery
5. Acceptance and quality
6. Documents and settlement readiness
7. Settlement and closure

Deviation, recalculation and dispute are exception branches, not mandatory steps. Gekta is cross-cutting intelligence and is not an eighth mandatory Deal step.

## Conversion contract

- Header primary conversion: `/platform-v7/register`
- Hero primary conversion: `/platform-v7/register`
- Final primary conversion: `/platform-v7/register`
- Deal/product exploration: secondary
- Presentation PDF: tertiary
- Organization-connection intake: optional assistance, not registration
- Contact inquiry: help channel, not registration and not cabinet access

Result on final deployed revision: **PENDING**

## Truthfulness contract

Final deployed public copy must not:

- present an unconfirmed 1C, EDI, bank, government or laboratory connection as live;
- invent an operator, processor, recipient, personal consent record or privacy request;
- report a local-only privacy action as durably submitted;
- expose `NOT_ATTESTED`, controlled-pilot, pre-integration or similar internal maturity jargon as visitor-facing copy;
- imply that Gekta signs documents, changes permissions, releases money or treats an unavailable source as positive evidence;
- imply that choosing a public role grants access.

Result on final deployed revision: **PENDING**

## Source and CI gate

Implementation branch: `feat/public-home-role-clarity-20260905`

Required before implementation merge:

- trusted-scope hardening PR accepted first;
- public-home governance scope accepted second;
- implementation synchronized to the accepted exact main;
- changed paths remain inside the accepted manifest;
- exact-head web unit checks: PASS;
- exact-head build: PASS;
- exact-head security / authority checks: PASS or explicitly allowed skip only where the existing trusted workflow defines it;
- exact-head Codex review gate: PASS;
- no unresolved current review threads;
- implementation no longer DRAFT only after the governance chain is accepted.

Final pre-merge exact head: **PENDING**

## Canonical production deployment

Production provider: **REG.RU only**

New recurring cost introduced by this work: **0 RUB**

Deployed revision / SHA: **PENDING**

Deployment evidence: **PENDING**

No production or visual claim in this document is valid until the deployed SHA above is populated and independently rechecked.

## Required viewport matrix

The homepage must be checked at these exact CSS viewport widths on the deployed revision:

| Width | Height used for acceptance | Reflow | Horizontal overflow | Primary registration visible | Touch targets | Typography | Header / anchor offset | Result |
| ---: | ---: | --- | --- | --- | --- | --- | --- | --- |
| 320 | 800 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| 375 | 812 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| 390 | 844 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| 430 | 932 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| 768 | 1024 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| 1280 | 900 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| 1440 | 900 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |

## Linked public pages

At minimum, mobile and desktop deployed checks must cover:

- `/platform-v7/about`
- `/platform-v7/how-it-works`
- `/platform-v7/ai-in-action`
- `/platform-v7/trust`
- `/platform-v7/contact`
- `/platform-v7/privacy`

For every checked linked page verify:

- route returns successfully;
- no horizontal overflow;
- public header is usable;
- registration remains the primary account-creation path where a conversion CTA is present;
- contact / assistance does not masquerade as registration;
- source-owned RU / EN / ZH copy is not replaced by a post-hydration DOM rewrite on the routes that are locale-native;
- no unsupported integration or certification claim appears.

Result: **PENDING**

## Accessibility acceptance

Required on the final deployed revision:

- skip link reaches main content;
- keyboard can reach every interactive control in logical order;
- role tabs support keyboard operation and preserve focus;
- visible focus is not removed;
- primary controls are at least 44 x 44 CSS px;
- forms retain labels, consent requirements and focus visibility;
- no serious or critical automated WCAG 2 A / AA / 2.1 AA / 2.2 AA findings on the tested public surfaces;
- forced-colors remains understandable;
- reduced-motion removes nonessential motion;
- text remains readable without horizontal scrolling at 320 CSS px.

Result: **PENDING**

## Human comprehension acceptance

A first-time visitor should be able to answer, without opening a protected cabinet:

- What is «Прозрачная Цена»?
- Is it for my role?
- What does my role do and receive?
- What are the seven ordinary Deal steps?
- What happens if quality or delivery deviates?
- What does Gekta do, and what is it not allowed to do?
- Are 1C / EDI / bank / government integrations actually connected for me yet?
- What is the difference between registration, contact and organization-connection assistance?
- What should I click to start using the platform?

Result: **PENDING**

## Final decision

Final score / acceptance: **NOT YET ASSIGNED**

A universal `100/100` result must not be entered from source review alone. It may be recorded only after the exact deployed REG.RU revision completes the viewport, linked-page, accessibility, truthfulness, conversion and human-comprehension checks above with no unresolved defect.