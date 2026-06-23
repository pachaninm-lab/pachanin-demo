# platform-v7 audit owner matrix — 2026-06-23

## Cabinet ownership model

Each role first screen should make ownership explicit.

| Role | Owns | Must not claim |
| --- | --- | --- |
| seller | lot readiness, documents provided, next seller action | buyer/bank/operator approval |
| buyer | demand, RFQ, acceptance decision | seller document truth or bank confirmation |
| bank | financing/reconciliation status display | real payment unless money layer exists |
| operator | exception handling and manual review | external provider callback unless adapter exists |
| executive | portfolio visibility and risk overview | operational action completion |
| compliance | evidence review and blocked reasons | automatic regulatory acceptance |
| lab/elevator/field | quality/logistics evidence status | platform-wide settlement readiness |

## UI requirement

Every blocked item needs a named responsible party and a next safe action.
