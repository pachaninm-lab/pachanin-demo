# Netlify deploy refresh

Purpose: safe docs-only marker to trigger the reserve Netlify deployment from `main` after the latest platform-v7 first-screen design update.

Latest verified main commit before this refresh: `c97d5d748f8e6fb5aec6a71db8fa77f33da0a2b7`.

Reserve host: `https://gleaming-mandazi-bb9856.netlify.app/platform-v7/`.

Scope:
- no platform UI changes in this marker;
- no runtime logic changes;
- no API / DB / live integration changes;
- no Vercel config changes;
- Netlify reserve deployment refresh only.

Created to force the hosting chain `GitHub main → Netlify production deploy` to pick up the premium mobile entry screen on `/platform-v7`.
