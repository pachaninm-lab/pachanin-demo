# Legacy deploy status cleanup

Active surface for platform-v7: Netlify.

Repo-side change applied:
- Vercel Git deployments are disabled for `main` and all branches through `vercel.json`.

Manual external cleanup still required if red legacy statuses continue:
- disconnect or disable legacy Vercel projects from this GitHub repository in Vercel settings;
- disconnect or disable the legacy Deno Deploy GitHub integration/project.

These external providers are not platform-v7 merge gates.
