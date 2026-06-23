# platform-v7 audit scope rule — 2026-06-23

## Rule

Keep each follow-up PR narrow. If a fix needs more than one layer, create separate PRs.

## Layers

- role cabinet UI;
- shared shell;
- route guard;
- CSS/mobile;
- copy/status truth;
- runtime contract;
- data model;
- access model;
- money ledger;
- document/evidence workflow;
- integrations;
- load;
- ops;
- QA.

## Fallback

If exact safe product files are not identified, create a docs-only mapping under `docs/platform-v7/audit/**` and continue after the safe scope is known.
