-- Auth audit hash-chain integrity.
--
-- The chain had no authoritative order and no single identity, and both gaps
-- were reachable in production:
--
--   1. created_at defaults to NOW(), which is transaction_timestamp() and is
--      therefore identical for every event written inside one transaction. The
--      only tie-break was the application-generated TEXT id, which is random,
--      so "the previous event of this chain" was resolved by lexicographic
--      accident. Two events written in one transaction could be linked in the
--      reverse of the order they happened.
--
--   2. The chain that a userless event belongs to was selected with
--      user_id = $1 and no session_id predicate, so a user chain absorbed the
--      events of that user's sessions. Two events could and did end up sharing
--      one parent — a fork in an append-only evidence chain.
--
-- chain_key materialises the chain identity once, in the database, so writer,
-- reader and verifier cannot disagree about it. chain_sequence gives the chain
-- a total order that does not depend on wall-clock ties. The unique indexes
-- turn the three chain invariants into constraints PostgreSQL enforces rather
-- than properties a test hopes for: one event per position, no repeated hash,
-- and at most one child per parent.

ALTER TABLE auth.audit_events
  ADD COLUMN IF NOT EXISTS chain_key TEXT
  GENERATED ALWAYS AS (COALESCE(session_id, user_id, 'auth-global')) STORED;

ALTER TABLE auth.audit_events
  ADD COLUMN IF NOT EXISTS chain_sequence BIGINT;

-- Backfill uses the best order still recoverable for historical rows. New rows
-- never rely on it: the writer assigns chain_sequence explicitly.
WITH ordered AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY COALESCE(session_id, user_id, 'auth-global')
      ORDER BY created_at, id
    ) AS position
  FROM auth.audit_events
)
UPDATE auth.audit_events AS target
SET chain_sequence = ordered.position
FROM ordered
WHERE target.id = ordered.id
  AND target.chain_sequence IS NULL;

-- Equivalent to NOT NULL, expressed as a constraint so the forward-only gate
-- does not have to reason about a column rewrite.
ALTER TABLE auth.audit_events
  DROP CONSTRAINT IF EXISTS auth_audit_events_chain_sequence_present;
ALTER TABLE auth.audit_events
  ADD CONSTRAINT auth_audit_events_chain_sequence_present
  CHECK (chain_sequence IS NOT NULL);

ALTER TABLE auth.audit_events
  DROP CONSTRAINT IF EXISTS auth_audit_events_chain_sequence_positive;
ALTER TABLE auth.audit_events
  ADD CONSTRAINT auth_audit_events_chain_sequence_positive
  CHECK (chain_sequence >= 1);

-- One event per position in a chain: no duplicate sequence, no lost position.
CREATE UNIQUE INDEX IF NOT EXISTS auth_audit_events_chain_position_key
  ON auth.audit_events (chain_key, chain_sequence);

-- A hash identifies exactly one event.
CREATE UNIQUE INDEX IF NOT EXISTS auth_audit_events_hash_key
  ON auth.audit_events (hash);

-- At most one child per parent. This is the constraint that makes a fork
-- impossible rather than merely unobserved.
CREATE UNIQUE INDEX IF NOT EXISTS auth_audit_events_prev_hash_key
  ON auth.audit_events (prev_hash)
  WHERE prev_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS auth_audit_events_chain_lookup_idx
  ON auth.audit_events (chain_key, chain_sequence DESC);
