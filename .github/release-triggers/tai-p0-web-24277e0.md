# TAI P0 canonical VPS web release

- Target source authority: `main`
- Exact target commit: `24277e008d25f66f52b56284ff83ca3eead39fb2`
- Exact canonical image: `ghcr.io/pachaninm-lab/grainflow-web:sha-24277e0`
- Affected production service: `web` only
- Production authority: REG.RU VPS behind Caddy
- Netlify/Vercel: explicitly excluded from production evidence
- Required acceptance: running OCI revision, live manifest, public home, TAI passport, dock, interactions, WCAG and 320–1440 px browser checks
- Rollback: previous immutable web image restored automatically if post-deploy acceptance fails
- TAI operational status after release: `NOT_ATTESTED`

This file is a one-release trigger. It authorizes no API, database, Caddy, Compose, environment, volume, network or non-web service mutation.
