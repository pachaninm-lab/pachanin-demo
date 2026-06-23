# platform-v7 action matrix guard — 2026-06-23

Use this classification for cabinet CTAs created from the reality audit.

## CTA classes

| Class | Allowed in UI PR | Requirement |
| --- | --- | --- |
| Route | yes | Link points to an existing route. |
| Section | yes | Link/scroll points to an existing section in the same cabinet. |
| Controlled-pilot action | yes, only if already supported | Copy must explain audit draft / operator review / external confirmation boundary. |
| Disabled blocked action | yes | Button is disabled and shows a specific reason. |
| Runtime mutation | no | Must be a separate runtime PR under #1982. |
| Money movement | no | Must not be claimed before ledger and bank basis exist. |
| External callback | no | Must not be claimed before adapter integration exists. |

## Minimum disabled reason

A disabled action must state:

- what blocks it;
- who owns the unblock;
- what evidence or external confirmation is missing;
- what the next safe action is.
