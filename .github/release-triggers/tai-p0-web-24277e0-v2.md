# TAI P0 canonical VPS web release v2

- Target source authority: `main`
- Exact target commit: `24277e008d25f66f52b56284ff83ca3eead39fb2`
- Exact canonical image: `ghcr.io/pachaninm-lab/grainflow-web:sha-24277e0`
- Affected production service: `web` only
- Production authority: REG.RU VPS `195.19.12.120` behind Caddy
- SSH transport: key-only, validated and retried before mutation
- Required acceptance: exact running OCI revision, live manifest and P0 markers
- Rollback: previous immutable web image restored automatically if post-deploy acceptance fails
- Netlify/Vercel: explicitly excluded from production evidence
- TAI operational status after release: `NOT_ATTESTED`
- Autonomous release attempt: `v2-1`

This file is a one-release trigger. It authorizes no API, database, Caddy, Compose configuration, environment, volume, network or non-web service mutation.
