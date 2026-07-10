# platform-v7 PostgreSQL RLS integration

This fixture is CI-only and must run against a fresh local PostgreSQL 16 service.

It intentionally:

- builds the physical database from the canonical Prisma schema with `prisma db push` on an empty ephemeral database;
- recreates the five permissive policy names found in the historical initial migration and proves canonical activation removes them;
- executes reads as `app_rls_test`, a `NOSUPERUSER NOBYPASSRLS` role;
- verifies own-tenant visibility, cross-tenant denial, mandatory five-field context and transaction-local context cleanup;
- contains no production credentials, hosts, migration deployment or production commands.

`setup.sql` seeds two tenants. `assert.sql` is fail-fast. The owning entry point is `scripts/platform-v7-rls-integration.sh`, executed by the required `API Tests` workflow.
