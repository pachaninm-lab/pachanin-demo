# Netlify deploy refresh

Purpose: safe docs-only marker to trigger the reserve Netlify deployment from `main` after the latest platform-v7 design merges.

Latest verified main commit before this refresh: `7eed4ef2239555f2ded1256d655c5f710d58ded5`.

Reserve host: `https://gleaming-mandazi-bb9856.netlify.app/platform-v7/`.

Scope:
- no platform UI changes;
- no runtime logic changes;
- no API / DB / live integration changes;
- no Vercel config changes;
- Netlify reserve deployment refresh only.

Created to force the hosting chain `GitHub main → Netlify production deploy` to pick up all merged changes from PR #1761–#1768.
