# platform-v7 money risk gate — 2026-06-23

Every role-cabinet first screen must expose money risk without implying live money movement.

## Required money-risk fields

- amount or exposure label, if known;
- risk source;
- responsible role;
- blocking evidence or confirmation;
- next safe action.

## Allowed copy examples

- `Money at risk: settlement exposure pending operator review.`
- `Blocked: bank confirmation is not connected in controlled-pilot mode.`
- `Next action: prepare audit draft for manual review.`

## Forbidden copy examples

- `Payment sent`;
- `Bank confirmed`;
- `Funds reserved`;
- `Automatic reconciliation complete`;
- `Live settlement ready`.

## Runtime boundary

Real money ledger, reconciliation, bank confirmation and settlement events belong to separate #1982 money/runtime PRs. UI PRs may only display controlled-pilot status and safe next action states.
