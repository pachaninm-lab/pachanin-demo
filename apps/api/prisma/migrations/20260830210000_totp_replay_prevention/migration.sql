-- Durable single-use enforcement for TOTP.
--
-- verifyTotp accepted a code against three time steps and recorded nothing, so
-- the same six digits verified again for as long as the window held. ASVS
-- V6.5.1 asks that a one-time code be usable exactly once, and RFC 6238 section
-- 5.2 says the same thing in the verifier's own terms: the implementation MUST
-- NOT accept a second attempt for a time step it has already accepted, and
-- should reject any attempt whose time step is not greater than the last one.
--
-- A monotonic counter per authenticator says exactly that, and says it in one
-- statement. The alternative - a table of consumed counters with a TTL - stores
-- more, needs a sweeper, and answers no question this column cannot.
--
-- Nullable with no default and no backfill: an authenticator that has never
-- completed a TOTP verification has no last counter, and inventing one would
-- either lock out a legitimate first use or silently accept a replay of
-- whatever the backfilled value implied. NULL means "nothing consumed yet",
-- which the consume predicate handles explicitly.
--
-- Widening only; no data is read, rewritten or moved. Raised as #4682.
ALTER TABLE auth.credential_states
  ADD COLUMN IF NOT EXISTS mfa_last_totp_counter BIGINT;

COMMENT ON COLUMN auth.credential_states.mfa_last_totp_counter IS
  'Highest TOTP time-step counter already accepted for this authenticator. A verification is consumed by an atomic conditional UPDATE that only advances it, so a replayed or stale counter changes no row and is refused. NULL means no TOTP has been accepted yet.';
