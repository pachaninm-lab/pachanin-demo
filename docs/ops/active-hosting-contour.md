# Active hosting contour

Date: 2026-06-30

Active deployment contour for platform-v7:

- @pc/web is the working web deployment check.
- Vercel projects are legacy and must not be used as release gates.
- Deno Deploy is legacy and must not be used as a release gate.

GitHub commit status interpretation:

- Green working status: @pc/web success.
- Ignored legacy statuses: Vercel and Deno.

Required external cleanup:

1. Disconnect the Vercel projects from the GitHub repository.
2. Disconnect the Deno Deploy project from the GitHub repository.
3. Remove Vercel and Deno from branch protection if they are configured as required checks.

Code note:

- `vercel.json` still exists for old Vercel configuration.
- `deno-proxy` is legacy and should not be treated as part of the active platform-v7 workspace.
