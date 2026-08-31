// The twelve identities the one-deal seed creates.
//
// In its own module because both the seeder and the persistent-auth harness
// need it, and seed.ts runs main() at import time — importing the seeder to
// borrow a constant would re-seed the database.
//
// The harness needs these at all because of #3670: it used to discover actors
// by scanning public.users for identifiers ending in '-e2e', which worked only
// while the auth principal held BYPASSRLS. Under the identity policies a
// pre-context scan returns nothing, so the actors are resolved by identifier
// through the bounded bootstrap functions instead.
export const PERSISTENT_ACTOR_USER_IDS = [
  'farmer-e2e',
  'buyer-e2e',
  'logistician-e2e',
  'driver-e2e',
  'surveyor-e2e',
  'elevator-e2e',
  'lab-e2e',
  'accounting-e2e',
  'compliance-e2e',
  'arbitrator-e2e',
  'operator-e2e',
  'executive-e2e',
] as const;
