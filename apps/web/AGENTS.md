# Platform agent instructions

Scope: work on the platform only in `apps/web`. The landing app is separate and should stay unchanged during platform tasks.

Product focus: `/platform-v7` is a controlled-pilot digital execution contour for grain deals: deal, logistics, acceptance, documents, money, dispute and evidence. Use accurate labels: sandbox, controlled-pilot, pilot-ready with accompaniment.

Routing: prefer constants from `@/lib/platform-v7/routes` for platform links.

Consistency: keep money, status, readiness, bank, logistics and dispute data aligned across platform screens.

Tests: add or update route and guard tests for changed behavior.

Copy: keep platform UI copy in Russian and avoid overstating integration maturity.
