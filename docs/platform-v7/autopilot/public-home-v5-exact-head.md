# Public Homepage V5 — exact-head acceptance

Scope: `/platform-v7` and `/platform-v7/how-it-works`.

Acceptance is valid only for the final PR head after all required checks complete successfully.

Required evidence:

- mobile reflow at 320, 360, 375, 390 and 430 CSS px;
- no horizontal overflow or fixed-control obstruction;
- support dialog focus trap, Escape close, focus return and background scroll lock;
- 200% text scale, reduced-motion and forced-colors safeguards;
- RU, EN and ZH public copy;
- explicit demonstration-data boundary and no fake-live identifiers;
- service navigation, institutional trust surfaces and legal/status links;
- successful Netlify preview build;
- successful exact-head CI, web-unit, design-system and security gates.

Maturity boundary: controlled pilot / pre-integration. This acceptance does not establish production-proven operation, live external integrations, live bank money movement, production capacity, HA or DR acceptance.
