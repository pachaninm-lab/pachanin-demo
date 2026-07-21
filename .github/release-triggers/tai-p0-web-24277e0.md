# TAI P0 canonical VPS web release

- Target source authority: `main`
- Exact target commit: `24277e008d25f66f52b56284ff83ca3eead39fb2`
- Exact canonical image: `ghcr.io/pachaninm-lab/grainflow-web:sha-24277e0`
- Affected production service: `web` only
- Production authority: REG.RU VPS `195.19.12.120` behind Caddy
- SSH transport: key-only, validated with bounded DNS, host-key and authentication retries before mutation
- Required acceptance: exact running OCI revision, live manifest and P0 markers
- Rollback: previous immutable web image restored automatically if deployment or live acceptance fails
- Netlify/Vercel: explicitly excluded from production evidence
- TAI operational status after release: `NOT_ATTESTED`
- Release attempt: `4` — hardened autonomous trusted `push/main` trigger

This file is a one-release trigger. It authorizes no API, database, Caddy, Compose configuration, environment, volume, network or non-web service mutation.
