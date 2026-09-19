import { randomBytes } from 'crypto';

/**
 * Centralised resolution of cryptographic secrets.
 *
 * Rationale (federal-scale, multi-tenant platform):
 *  - We NEVER ship a static literal fallback secret in source. A guessable
 *    default (e.g. a `|| 'dev-secret'`) means anyone reading the repo can forge
 *    admin JWTs or bank/webhook callbacks whenever the env var is unset.
 *  - Production fails CLOSED: if a required secret is missing (or too weak) the
 *    process refuses to start rather than run with an insecure default.
 *  - Non-production generates a random, per-process EPHEMERAL secret so local
 *    dev and CI work without a shipped constant. It is intentionally not stable
 *    across restarts — it must never be relied upon as a real secret.
 */

const MIN_SECRET_LENGTH = 32;

function isProduction(): boolean {
  return String(process.env.NODE_ENV || '').toLowerCase() === 'production';
}

const ephemeralSecrets = new Map<string, string>();

/**
 * Resolve a required secret by env-var name.
 * @throws in production when the secret is missing or shorter than 32 chars.
 */
export function requireSecret(name: string): string {
  const value = String(process.env[name] || '').trim();

  if (value) {
    if (value.length < MIN_SECRET_LENGTH) {
      throw new Error(
        `[secrets] ${name} is set but too weak (< ${MIN_SECRET_LENGTH} chars). Refusing to start.`,
      );
    }
    return value;
  }

  if (isProduction()) {
    throw new Error(
      `[secrets] ${name} is required in production but is not set. ` +
        `Refusing to start with an insecure default — configure ${name} in the environment.`,
    );
  }

  let ephemeral = ephemeralSecrets.get(name);
  if (!ephemeral) {
    ephemeral = randomBytes(48).toString('hex');
    ephemeralSecrets.set(name, ephemeral);
    // eslint-disable-next-line no-console
    console.warn(
      `[secrets] ${name} not set — using a random ephemeral development secret. ` +
        `Set ${name} in the environment for stable/production use.`,
    );
  }
  return ephemeral;
}
