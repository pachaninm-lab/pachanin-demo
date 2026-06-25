# platform-v7 external status control

Netlify is the active deployment surface for platform-v7.

Vercel Git deployments are disabled in `vercel.json` for `main` and all branches. This prevents legacy Vercel integrations from creating blocked deployment noise on normal platform-v7 PRs and merges.

Deno Deploy statuses are external to the repository code path. If they keep appearing, disable the Deno GitHub integration or disconnect the Deno project from this repository in the Deno project settings. Do not treat Deno Deploy as a platform-v7 merge gate.

Current merge gate for platform-v7:
- GitHub Actions CI / Node CI / unit checks
- CodeQL report mode
- Qodana report mode
- Netlify preview / production deploy

Not a platform-v7 gate:
- Vercel legacy projects
- Deno Deploy legacy project
