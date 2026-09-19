# platform-v7 Claude Code PR Checklist

Before merging any Claude Code executor PR, verify all items below.

## Scope
- [ ] All changed files are within `allowedCurrentScope` from `autopilot-state.json`
- [ ] No `apps/landing` changes
- [ ] No product runtime / UI / API / DB / live integrations / theme / onboarding
- [ ] No lockfile changes (`package-lock.json`, `pnpm-lock.yaml`)
- [ ] No changes to files listed in `forbiddenZones` in `autopilot-state.json`

## Claims
- [ ] No production-ready claims in PR body or changed files
- [ ] No fake-live claims
- [ ] Maturity language is `controlled-pilot / pre-integration` or absent

## CI
- [ ] `platform-v7 autopilot guard` — green
- [ ] `ci` — green
- [ ] `build` — green
- [ ] `dependency-review` — may be red (pre-existing repo-wide issue, not a blocker)
- [ ] Vercel deploy — may be red (not a blocker)

## Audit marker
- [ ] PR body or a committed file identifies this as a Claude Code executor PR
      (see `claude-code-audit-marker.md`)

## Fallback autopilot
- [ ] Fallback autopilot loop is still active (check `autopilot-state.json`
      `currentStatus` — `ready` or `blocked` are both fine; `active` means a
      run is in progress)
- [ ] No changes to `agentWritableScope` that would break the fallback runner

## One PR per change
- [ ] This PR addresses exactly one logical concern
- [ ] No unrelated files bundled in
