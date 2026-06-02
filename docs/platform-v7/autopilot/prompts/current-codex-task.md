# Current task

Agent PR Creation Reliability.

Allowed files:

- .github/workflows/platform-v7-agent-runner.yml
- scripts/p7-agent-runner.sh

Goal:

- Keep work PR-only.
- Open generated pull requests reliably after the runner creates changes.
- Make retry safe after a partial push or pull-request creation failure.
- Keep readiness at 72.
