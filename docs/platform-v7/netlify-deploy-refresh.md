# Netlify deploy refresh

Purpose: safe docs-only marker to force the active Netlify production chain to rebuild `main` after the owner cabinet handoff fix and the addition of server-mapped test organizations for all twelve cabinets.

Latest verified main commit before this refresh: `4afc81336045a7283ae5d7c3c67f9d865b174eee`.

Active production host: `https://процент-агро.рф/platform-v7/`.
Netlify project: `vermillion-kitsune-0e7b97`.

Refresh marker timestamp: 2026-07-12T12:39:22Z.

Scope:
- no platform UI changes in this marker;
- no runtime logic changes;
- no API / DB / live integration changes;
- deploy trigger only;
- production must include PR #2389 and PR #2391.

Expected production content:
- owner cabinet buttons use the server-verified native POST handoff;
- PLATFORM_OWNER verification and CSRF validation remain mandatory;
- signed cabinet context remains authoritative;
- nine clearly marked test organizations cover all twelve owner-access cabinets;
- the canonical test deal remains linked to the approved role-to-organization mapping.

Created to force the hosting chain `GitHub main → Netlify production deploy` to pick up commit `4afc81336045a7283ae5d7c3c67f9d865b174eee` instead of the stale production commit `4aff09572d813b382cc742112541cb75d278740a`.
