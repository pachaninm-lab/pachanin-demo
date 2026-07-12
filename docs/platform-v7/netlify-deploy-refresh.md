# Netlify deploy refresh

Purpose: safe docs-only marker to force the active Netlify production chain to rebuild `main` after the owner cabinet CSRF bootstrap repair.

Latest verified main commit before this refresh: `1033f8ba1195c0a6907d431f4dc107b13d60a80b`.

Active production host: `https://процент-агро.рф/platform-v7/`.
Netlify project: `vermillion-kitsune-0e7b97`.

Refresh marker timestamp: 2026-07-12T13:01:00Z.

Scope:
- no platform UI changes in this marker;
- no API / DB / live integration changes;
- deploy trigger only;
- production must include PR #2389, PR #2391 and PR #2392.

Expected production content:
- owner cabinet buttons use the server-verified native POST handoff;
- existing authenticated owner sessions without a CSRF cookie are repaired before cabinet forms render;
- PLATFORM_OWNER verification and CSRF validation remain mandatory;
- signed cabinet context remains authoritative;
- nine clearly marked test organizations cover all twelve owner-access cabinets;
- the canonical test deal remains linked to the approved role-to-organization mapping.

Created to force the hosting chain `GitHub main → Netlify production deploy` to pick up commit `1033f8ba1195c0a6907d431f4dc107b13d60a80b` instead of the prior production commit `4afc81336045a7283ae5d7c3c67f9d865b174eee`.
