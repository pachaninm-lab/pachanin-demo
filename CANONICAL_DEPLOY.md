# Canonical deploy

**Host: Netlify (sole production host).** Vercel has been decommissioned.

- Source of truth: `main`.
- Deploy: Netlify Git integration builds `apps/web` on push to `main`
  (`netlify.toml`: `pnpm --filter @pc/web build`, publish `apps/web/.next`,
  `@netlify/plugin-nextjs`).
- Primary URL: `https://vermillion-kitsune-0e7b97.netlify.app`
- Set production env vars (secrets, `NEXT_PUBLIC_SITE_URL`, cabinet vars) in
  Netlify → Site settings → Environment variables.

Post-deploy route check: `/platform-v7/`, `/platform-v7/deals`,
`/platform-v7/bank`, `/platform-v7/control-tower`, `/platform-v7/login`.
