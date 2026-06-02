# platform-v7 agent PR creation reliability

Purpose: authorize a narrow infrastructure recovery step after the post-#1468 runner reached generated changes but failed while opening the generated pull request.

Status remains controlled-pilot / pre-integration.

Allowed scope for the next PR:
- .github/workflows/platform-v7-agent-runner.yml
- scripts/p7-agent-runner.sh

Requirements:
- keep work PR-only;
- do not touch apps/landing;
- do not touch product UI, API, DB, adapters, theme, onboarding or lockfiles;
- keep generated pull requests labeled platform-v7 and agent-generated;
- make PR creation recoverable after partial push/create failures;
- do not claim 24/7 autonomous coding is proven until a new generated PR after this fix completes checks and safe merge.

After this reliability step is green and merged, return current step to Role Boundary Smoke.
