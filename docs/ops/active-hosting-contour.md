# Active hosting contour

Date: 2026-06-30 (updated: Vercel decommissioned)

Active deployment contour for platform-v7:

- **Netlify is the sole production host** (`@pc/web` built via `netlify.toml`).
- Vercel has been removed: config (`vercel.json`), the CLI deploy jobs, and the
  Vercel smoke/URL references are deleted. Vercel projects/statuses must not be
  used as release gates.
- Deno Deploy is legacy and must not be used as a release gate.

GitHub commit status interpretation:

- Green working status: `@pc/web` build success + Netlify deploy.
- Ignored legacy statuses: any remaining Vercel or Deno status.

Required external cleanup (outside this repo):

1. Disconnect the Vercel projects from the GitHub repository (if still linked).
2. Remove Vercel from branch protection if configured as a required check.
3. Disconnect the Deno Deploy project from the GitHub repository.
