# platform-v7 PostgreSQL RLS integration

This fixture is CI-only and must run against a fresh local PostgreSQL 16 service.

It intentionally:

- applies only the canonical initial schema and runtime-persistence migration;
- removes permissive legacy policies before assertions;
- executes reads as `app_rls_test`, a `NOSUPERUSER NOBYPASSRLS` role;
- verifies own-tenant visibility, cross-tenant denial, mandatory five-field context and transaction-local context cleanup;
- contains no production credentials, hosts or deployment commands.

`setup.sql` seeds two tenants. `assert.sql` is fail-fast. The owning entry point is `scripts/platform-v7-rls-integration.sh`, executed by the required `API Tests` workflow.
