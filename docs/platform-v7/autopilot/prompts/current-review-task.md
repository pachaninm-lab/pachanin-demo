# Review task

Current infrastructure reliability layer.

Allowed files:

- .github/workflows/platform-v7-agent-runner.yml
- scripts/p7-agent-runner.sh

Review focus:

- no apps/landing changes;
- no product UI, API, DB, adapters, theme, onboarding or lockfile changes;
- pull-request creation is recoverable after partial failure;
- generated work remains PR-only;
- readiness remains 72.
