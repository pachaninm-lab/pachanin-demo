# Public Deal Journey 10/10 acceptance

Status: IMPLEMENTED_ON_BRANCH / NOT_PRODUCTION_ACCEPTED.

Scope: `/platform-v7/how-it-works` public presentation UX only. No TAI model/runtime, transaction-state, RBAC, tenant, API, database, persistence, banking execution or external-integration authority changes.

## Product acceptance

The public first layer must:

1. start from visitor intent, not system role;
2. keep one demonstrational Deal as the persistent primary object;
3. provide Quick and Detailed progressive-disclosure modes;
4. explain every quick stage through what happened, visitor action, platform action, acting participant, money, documents, risk and next step;
5. use plain-language scenario names before formal operational labels;
6. show money and documents only as demonstrational/target-contour state, never as live banking claims;
7. end with a concrete Deal result, one primary organization-connect CTA and one secondary scenario-replay action;
8. preserve the detailed industrial explorer as the second layer;
9. provide complete RU/EN/ZH copy;
10. preserve URL/history semantics and analytics.

## Technical acceptance

- 320 / 390 / 430 CSS-pixel mobile coverage;
- zero horizontal overflow;
- minimum touch target coverage;
- Chromium/WebKit/Firefox browser matrix;
- accessibility gate;
- existing transaction/RBAC/security gates unchanged;
- exact-head CI terminal PASS before merge;
- exact-main REG.RU release after merge;
- route-specific live evidence for `/platform-v7/how-it-works` after deployment.

## Human usability acceptance

A final 10/10 claim requires real representative users; internal review alone is not sufficient. Target thresholds:

- purpose understood in 5 seconds: >=95%;
- correct path chosen without help: >=95%;
- own role understood: >=95%;
- current stage understood: >=95%;
- next step understood: >=95%;
- money state understood: >=90%;
- document state understood: >=90%;
- difference from a marketplace explained: >=90%;
- scenario completed without help: >=95%;
- critical UX defects: 0;
- accessibility/touch blockers: 0.
