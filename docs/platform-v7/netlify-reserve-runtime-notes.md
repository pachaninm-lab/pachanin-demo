# Netlify reserve runtime notes

Netlify reserve deploy uses pnpm with a hoisted node_modules layout.

Reason: the Netlify serverless Next.js runtime can fail to resolve nested pnpm dependencies such as `styled-jsx/style` when packaged from the default isolated pnpm layout. The hoisted layout is scoped to Netlify through `netlify.toml` and does not change product code, lockfiles, API, DB, integrations, UI, or apps/landing.
