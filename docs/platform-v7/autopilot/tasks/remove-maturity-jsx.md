# Remove homepage maturity block from JSX

Owner decision: physically remove the entire `<section id='maturity'>...</section>` from `apps/web/components/platform-v7/PlatformV7StrategicHomeStory.tsx`, remove the matching `<a href='#maturity'>...</a>` nav entry, and update `apps/web/tests/unit/platformV7PublicTrustBlockRemoval.test.ts` so it asserts the JSX source no longer contains `id='maturity'`, `story.trust.items`, `story.trust.metrics`, `story.trust.integrations`, or `story.trust.ladder`.

Do not use CSS hiding. Do not change backend, database, auth/RBAC, Deal, TAI authority, financial authority, or production topology.
