# Netlify deploy refresh

Purpose: safe docs-only marker to trigger the active reserve Netlify deployment from `main` after the latest platform-v7 mobile shell and role-dock fixes.

Latest verified main commit before this refresh: `923e64dd2ed39ec92e06d143d5eefbce61f27562`.

Active reserve host: `https://vermillion-kitsune-0e7b97.netlify.app/platform-v7/`.
Secondary reserve host: `https://gleaming-mandazi-bb9856.netlify.app/platform-v7/`.

Refresh marker timestamp: 2026-06-18T21:31:00Z.

Scope:
- no platform UI changes in this marker;
- no runtime logic changes;
- no API / DB / live integration changes;
- no Vercel config changes;
- Netlify reserve deployment refresh only.

Created to force the hosting chain `GitHub main → Netlify production deploy` to pick up the latest mobile shell visibility, role-dock and calculator header fixes on `/platform-v7`.
