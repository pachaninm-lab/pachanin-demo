# platform-v7 role order guard — 2026-06-23

## Required order after audit

1. seller;
2. buyer;
3. bank;
4. operator / executive;
5. compliance;
6. lab / elevator / field roles where exact files exist.

## Role PR rule

Each role-cabinet PR must touch only the exact files for that role unless a shared-shell defect is proven. Shared-shell changes must be split into a separate PR.

## First-screen invariant

Every role first screen must answer:

- what happened;
- what is blocked;
- money at risk;
- responsible party;
- next action.

## Isolation invariant

A role must not expose operational actions owned by another role. Cross-role visibility must be informational only unless there is an explicit controlled-pilot route/action boundary.
