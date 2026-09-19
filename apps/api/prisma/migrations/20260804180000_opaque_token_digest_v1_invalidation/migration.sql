-- Controlled invalidation of every opaque one-time token digested under the
-- previous scheme.
--
-- Opaque tokens now digest through the credential/token authority: an
-- HKDF-derived key with domain separation, the purpose bound into the
-- pre-image, and a versioned `v1:<base64url>` stored form. A digest produced by
-- the old generic keyed hash can never match a digest produced by the new one,
-- so every pending row minted before this migration is already unusable — its
-- bearer holds a token that will never verify again.
--
-- The choice here is deliberate and recorded rather than implicit. There is no
-- dual-read window and no legacy fallback: keeping one would mean carrying two
-- verification paths for a bearer credential indefinitely, which is exactly the
-- ambiguity the separate contour was introduced to remove. Instead the rows are
-- closed out explicitly, so the database states plainly that these challenges
-- ended rather than leaving them PENDING forever and letting expiry sweeps and
-- operator queries disagree about why they never completed.
--
-- The effect on a live deployment is bounded and self-healing: an unfinished
-- password reset, email verification, invitation acceptance, MFA recovery or
-- membership selection must be restarted, and an active session must log in
-- again. No completed state is touched — CONSUMED, ACCEPTED, EXPIRED and
-- REVOKED rows keep their history, and nothing here deletes a row.
--
-- On a clean database every statement matches zero rows, which is why this is
-- safe to run unconditionally rather than gated on an environment check.

-- Sessions and refresh families: the bearer must authenticate again.
UPDATE auth.refresh_tokens
SET status = 'REVOKED',
    revoked_at = NOW(),
    revocation_reason = 'OPAQUE_TOKEN_DIGEST_V1_MIGRATION'
WHERE status = 'ACTIVE';

-- MFA_PENDING too: such a session is waiting on a challenge token that can no
-- longer verify, so leaving it open would strand it until its own TTL.
UPDATE auth.sessions
SET status = 'REVOKED',
    revoked_at = NOW(),
    revocation_reason = 'OPAQUE_TOKEN_DIGEST_V1_MIGRATION'
WHERE status IN ('ACTIVE', 'MFA_PENDING');

-- Short-lived challenges: restarting them is a single user action.
UPDATE auth.mfa_challenges
SET status = 'EXPIRED'
WHERE status = 'PENDING';

UPDATE auth.membership_selection_challenges
SET status = 'EXPIRED'
WHERE status = 'PENDING';

UPDATE auth.password_reset_challenges
SET status = 'EXPIRED'
WHERE status = 'PENDING';

UPDATE auth.registration_email_challenges
SET status = 'EXPIRED'
WHERE status = 'PENDING';

UPDATE auth.mfa_recovery_challenges
SET status = 'EXPIRED',
    version = version + 1
WHERE status = 'PENDING';

-- Invitations carry a longer TTL, so they are expired rather than revoked: the
-- administrator re-sends and the invitee receives a fresh token.
UPDATE auth.organization_invitations
SET status = 'EXPIRED',
    version = version + 1,
    updated_at = NOW()
WHERE status = 'PENDING';

-- Staff access sessions are privileged and short-lived; re-issuing one goes
-- through the ordinary approval path.
UPDATE auth.staff_access_sessions
SET status = 'ENDED',
    ended_at = NOW(),
    end_reason = 'OPAQUE_TOKEN_DIGEST_V1_MIGRATION',
    updated_at = NOW()
WHERE status = 'ACTIVE';
