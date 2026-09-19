'use strict';

// The staff-access suite uses two deliberately separate database identities:
// - AUTH_DATABASE_URL for the confined runtime whose permissions are under test;
// - ONE_DEAL_ADMIN_URL only to create deterministic fixture rows before tests.
// setupFiles execute before the test modules are imported, so PrismaClient
// construction cannot accidentally fall back to the runtime datasource.
if (!process.env.STAFF_ACCESS_TEST_ADMIN_URL) {
  process.env.STAFF_ACCESS_TEST_ADMIN_URL = process.env.ONE_DEAL_ADMIN_URL || '';
}
