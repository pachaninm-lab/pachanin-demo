# platform-v7 Netlify gate note

Linked issues: #1974 #1978 #1984

Netlify remains the active frontend hosting gate for platform-v7.

## Merge interpretation

- Netlify success/ready is required when frontend deploy status is relevant.
- Deprecated Vercel and Deno statuses are non-blocking unless GitHub branch protection rejects merge.
- Docs-only PRs may have no relevant Netlify preview; in that case GitHub checks and changed-file review are the active gate.

## Current PR type

Docs-only audit/control checkpoint. No runtime or frontend code is changed.