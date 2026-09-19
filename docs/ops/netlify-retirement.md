# Netlify retirement authority

Status: permanent retirement.

## Binding decision

- `процент-агро.рф` is served only from the REG.RU VPS production contour.
- Netlify is not production, preview, fallback, disaster recovery, DNS, CDN, build, release or acceptance authority.
- Netlify deploy previews, build hooks, site aliases, CLI usage, environment tokens and GitHub deployment integrations are forbidden.
- A successful Netlify deployment or status must never be used as evidence that any project change is live.

## Repository enforcement

`node scripts/check-netlify-retirement.mjs` fails when active source, workflows, infrastructure or scripts contain a Netlify deployment/runtime reference or when a Netlify configuration/state path exists.

`.github/workflows/netlify-retirement-authority.yml` runs the check on every pull request, every push to `main`, and manual audit.

## External control-plane retirement

The following settings must remain absent outside the repository:

1. No Netlify custom-domain assignment for `процент-агро.рф` or its Punycode equivalent.
2. No DNS record routing the brand domain to Netlify.
3. No GitHub App, webhook, deploy key, status check or build hook capable of starting a Netlify deployment.
4. No active Netlify access token or repository environment secret.
5. No Netlify site treated as an operational platform asset.

External deletion is verified only from the relevant provider control plane. Repository state cannot by itself prove those provider-side deletions.

## Allowed historical wording

Historical documentation may mention Netlify only to state that it is retired and must be ignored. It may not include an actionable deploy command, active URL, token name, build hook, recovery instruction or acceptance criterion.
