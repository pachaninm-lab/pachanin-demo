# Netlify deploy refresh

Purpose: safe docs-only marker to force the active Netlify production chain to rebuild `main` after the observable owner cabinet transition fix.

Latest verified main commit before this refresh: `fa41e114d71aa7ebcdb39265770c0927cb0f55b3`.

Active production host: `https://процент-агро.рф/platform-v7/`.
Netlify project: `vermillion-kitsune-0e7b97`.

Refresh marker timestamp: 2026-07-12T13:20:00Z.

Scope:
- no additional runtime changes in this marker;
- no API / DB / live integration changes;
- deploy trigger only;
- production must include PR #2389, PR #2391, PR #2392 and PR #2393.

Expected production content:
- owner cabinet buttons show an immediate opening state;
- cabinet opening uses an authenticated JSON POST with CSRF header and same-origin credentials;
- exact server rejection codes are visible instead of a silent return to the owner page;
- successful server response navigates directly to the verified cabinet route;
- native POST remains as a no-JavaScript fallback;
- PLATFORM_OWNER verification, signed cabinet context and role-to-organization mapping remain authoritative;
- nine clearly marked test organizations cover all twelve owner-access cabinets.

Created to force the hosting chain `GitHub main → Netlify production deploy` to pick up commit `fa41e114d71aa7ebcdb39265770c0927cb0f55b3` instead of the prior production commit `7876c940d5d107f514aadb62a71cb48f0531dba4`.
