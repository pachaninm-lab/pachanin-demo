# platform-v7 baseline runbook

This folder is reserved for Lighthouse, accessibility and route-discovery baselines.

## Honest status

The baseline metrics were not executed from this ChatGPT session because the connected environment did not expose a local clone with installed dependencies and browser runtime.

Do not fabricate Lighthouse numbers. Run the commands below in Codex, local dev, or CI and commit the resulting JSON/HTML artifacts.

## Required commands

From repo root:

```bash
pnpm install
pnpm --filter @pc/web build
pnpm --filter @pc/web start
```

In another shell:

```bash
npx lighthouse http://localhost:3000/platform-v7/control-tower --output=json --output-path=docs/baseline/lh-control-tower.json
npx lighthouse http://localhost:3000/platform-v7/deals --output=json --output-path=docs/baseline/lh-deals.json
npx lighthouse http://localhost:3000/platform-v7/bank --output=json --output-path=docs/baseline/lh-bank.json
npx lighthouse http://localhost:3000/platform-v7/disputes --output=json --output-path=docs/baseline/lh-disputes.json
npx lighthouse http://localhost:3000/platform-v7/seller --output=json --output-path=docs/baseline/lh-seller.json
npx lighthouse http://localhost:3000/platform-v7/buyer --output=json --output-path=docs/baseline/lh-buyer.json
npx lighthouse http://localhost:3000/platform-v7/driver --output=json --output-path=docs/baseline/lh-driver.json
npx lighthouse http://localhost:3000/platform-v7/elevator --output=json --output-path=docs/baseline/lh-elevator.json
npx lighthouse http://localhost:3000/platform-v7/lab --output=json --output-path=docs/baseline/lh-lab.json
npx lighthouse http://localhost:3000/platform-v7/demo --output=json --output-path=docs/baseline/lh-demo.json
```

## Baseline acceptance

- JSON files for 10 key pages are committed.
- Scores are captured before E1 changes.
- Any page below target is not hidden; it becomes an explicit improvement target.
- No production readiness claim is made from synthetic Lighthouse alone.
