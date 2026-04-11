# platform-v4-redesign

UI/UX redesign preview for `platform-v4`.

## Purpose
This route is a safe additive rollout for redesign work. It does not change pricing logic, deal calculations, banking logic, or financial business rules. It is focused on the UI/UX layer only.

## Preview routes
- `/platform-v4-redesign`
- `/platform-v4-redesign/roles`
- `/platform-v4-redesign/seller`
- `/platform-v4-redesign/buyer`
- `/platform-v4-redesign/deal`
- `/platform-v4-redesign/driver`
- `/platform-v4-redesign/receiving`
- `/platform-v4-redesign/bank`
- `/platform-v4-redesign/documents`
- `/platform-v4-redesign/control`

## What changed
- trust-first hero with price ticker, role entry, trust bar, and live counters
- simplified market dashboard with three priority zones
- seller first screen starts with money and blockers
- buyer first screen is shortlist-first instead of endless catalog
- deal screen is reframed as cockpit
- driver screen is reduced to a field-ready mobile flow
- receiving screen is reframed as queue + handoff flow
- bank screen is reframed as reserve / hold / release / mismatch
- documents screen is reframed around criticality and release readiness
- control screen is reframed as war-room / evidence / money-at-risk

## Review intent
This preview exists to make review and cutover safer:
1. review the UX/UI direction without touching current `/platform-v4`
2. validate mobile and tablet readability
3. decide whether to replace `/platform-v4` directly or do staged cutover

## Non-goals in this route
- no calculation changes
- no banking API changes
- no settlement logic changes
- no backend behavioral changes

## Next step after review
Merge the preview, then decide on one of two cutover paths:
- direct replacement of `/platform-v4`
- staged replacement screen-by-screen
