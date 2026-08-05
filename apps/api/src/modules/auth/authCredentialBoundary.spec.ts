import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * A password belongs to the credential contour and nowhere else: bcrypt when
 * it is stored, bcrypt when it is verified. It is never an input to an
 * idempotency, audit or correlation fingerprint.
 *
 * That rule is invisible at a call site — `hashAuthMaterial(x)` looks
 * identical whether `x` is a 256-bit random token or a user's password — so it
 * is enforced statically here rather than left to review. Reintroducing the
 * defect breaks the build instead of waiting for a scanner to notice.
 */
const AUTH_DIRECTORIES = [join(__dirname), join(__dirname, '..', 'staff-access')];

// Keyed and fast hashes. Legitimate for high-entropy material, never for a
// password or anything derived from one.
const FAST_HASH_HELPERS = ['hashAuthMaterial', 'hashClientValue', 'sha256', 'createHmac', 'createHash'];

const CREDENTIAL_ARGUMENT = /\b(?:password|passphrase|passwordFingerprint|plaintextPassword|newPassword|currentPassword)\b/i;

/**
 * Comments become equal-length whitespace rather than disappearing, so every
 * reported line number still points at the real file. Without this a doc
 * comment that merely *discusses* passwords reads as a violation.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
}

/**
 * The expression parts of a call, with literal text removed.
 *
 * `hashAuthMaterial(`password-reset:${email}`)` hashes an account identity
 * under a purpose label; the label is prose in a string and says nothing about
 * what is hashed. Only what the code evaluates counts, so plain strings are
 * dropped and a template contributes just its `${…}` interpolations.
 */
function expressionsOnly(call: string): string {
  const withoutTemplates = call.replace(/`(?:[^`\\]|\\.)*`/g, (template) => {
    const interpolations = template.match(/\$\{[^}]*\}/g) ?? [];
    return ` ${interpolations.join(' ')} `;
  });
  return withoutTemplates.replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g, ' ');
}

function sourceFiles(): Array<{ path: string; source: string }> {
  const files: Array<{ path: string; source: string }> = [];
  for (const directory of AUTH_DIRECTORIES) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.ts') || entry.name.endsWith('.spec.ts')) continue;
      const path = join(directory, entry.name);
      files.push({ path, source: readFileSync(path, 'utf8') });
    }
  }
  return files;
}

/**
 * Every argument list passed to a fast hash helper, with its source line.
 *
 * The walk to the matching close paren is quote-aware: a parenthesis inside a
 * string or template must not move the depth, or one unbalanced literal
 * swallows the rest of the file and every later check reads garbage.
 */
function fastHashArguments(rawSource: string): Array<{ line: number; call: string }> {
  const source = stripComments(rawSource);
  const calls: Array<{ line: number; call: string }> = [];
  for (const helper of FAST_HASH_HELPERS) {
    const pattern = new RegExp(`\\b${helper}\\s*\\(`, 'g');
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) {
      let depth = 1;
      let index = match.index + match[0].length;
      let quote: string | null = null;
      while (index < source.length && depth > 0) {
        const char = source[index];
        if (quote) {
          if (char === '\\') index += 1;
          else if (char === quote) quote = null;
        } else if (char === "'" || char === '"' || char === '`') quote = char;
        else if (char === '(') depth += 1;
        else if (char === ')') depth -= 1;
        index += 1;
      }
      calls.push({
        line: source.slice(0, match.index).split('\n').length,
        call: source.slice(match.index, index),
      });
    }
  }
  return calls;
}

describe('credential boundary', () => {
  const files = sourceFiles();

  it('reads the auth sources it claims to guard', () => {
    expect(files.length).toBeGreaterThan(10);
    expect(files.some((f) => f.path.endsWith('auth-crypto.ts'))).toBe(true);
    expect(files.some((f) => f.path.endsWith('registration-application.service.ts'))).toBe(true);
    expect(files.some((f) => f.path.endsWith('password-reset-token.ts'))).toBe(true);
  });

  it('never passes a password or a password-derived value to a fast hash', () => {
    const violations: string[] = [];
    for (const { path, source } of files) {
      for (const { line, call } of fastHashArguments(source)) {
        // `passwordHash` is the bcrypt output; hashing *that* is not the defect.
        const argument = expressionsOnly(call).replace(/\bpasswordHash\b/g, 'bcryptOutput');
        if (CREDENTIAL_ARGUMENT.test(argument)) {
          violations.push(`${path}:${line} ${call.replace(/\s+/g, ' ').slice(0, 120)}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  // The second half of the boundary: an opaque one-time token is a bearer
  // credential and must digest through the authority, where it is bound to a
  // purpose and a version. The generic keyed hash offers neither.
  it('never passes an opaque token to the generic keyed hash', () => {
    const TOKEN_ARGUMENT = /\b(?:rawToken|refreshToken|challengeToken|backupCode|accessToken|opaqueToken)\b|\btoken\b(?!_)/i;
    const violations: string[] = [];
    for (const { path, source } of files) {
      if (path.endsWith('opaque-token-authority.ts')) continue;
      for (const { line, call } of fastHashArguments(source)) {
        if (!/^hashAuthMaterial|^hashClientValue/.test(call)) continue;
        if (TOKEN_ARGUMENT.test(expressionsOnly(call))) {
          violations.push(`${path}:${line} ${call.replace(/\s+/g, ' ').slice(0, 120)}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('routes every opaque token contour through the authority', () => {
    const authority = files.find((f) => f.path.endsWith('opaque-token-authority.ts'));
    expect(authority).toBeDefined();
    for (const name of ['password-reset', 'mfa-recovery', 'invitation', 'email-verification',
      'membership-selection', 'registration-status', 'staff-access']) {
      expect(authority?.source).toContain(`'${name}'`);
    }
    // Minting and parsing live only in the authority.
    const strays = files.filter((f) => !f.path.endsWith('opaque-token-authority.ts')
      && /export function (?:makeOpaqueToken|parseOpaqueToken)\b/.test(f.source));
    expect(strays.map((f) => f.path)).toEqual([]);
  });

  // Fixtures are the third way this boundary breaks. A spec that seeds a
  // credential column with the generic keyed hash passes on its own mocks and
  // hides a mint/verify asymmetry until a real database rejects every login.
  it('seeds no credential column with a generic keyed hash in any fixture', () => {
    const CREDENTIAL_COLUMN = /\b(?:mfa_backup_hashes|token_hash|challenge_token_hash|refresh_token_hash|status_token_hash|backupHashes|tokenHash)\b/;
    const violations: string[] = [];
    for (const directory of AUTH_DIRECTORIES) {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith('.spec.ts')) continue;
        const path = join(directory, entry.name);
        // The boundary spec itself names these patterns as test data.
        if (entry.name === 'authCredentialBoundary.spec.ts') continue;
        const source = stripComments(readFileSync(path, 'utf8'));
        source.split('\n').forEach((line, index) => {
          if (CREDENTIAL_COLUMN.test(line) && /\bhashAuthMaterial\s*\(/.test(line)) {
            violations.push(`${path}:${index + 1} ${line.trim().slice(0, 110)}`);
          }
        });
      }
    }
    expect(violations).toEqual([]);
  });

  // A credential comes into existence in exactly one place. If a call site can
  // assemble its own token or reach a crypto primitive, the purpose binding and
  // the version are advisory rather than structural.
  it('mints credentials only inside the authority', () => {
    const SELF_MINTING = /\bmakeOpaqueToken\s*\(|\bcreateHmac\s*\(|randomBytes\(\s*\d+\s*\)\s*\.toString\(\s*'base64url'\s*\)/;
    const OWNERS = ['opaque-token-authority.ts', 'auth-crypto.ts'];
    const violations = files
      .filter((f) => !OWNERS.some((owner) => f.path.endsWith(owner)))
      .filter((f) => SELF_MINTING.test(stripComments(f.source)))
      .map((f) => f.path);

    expect(violations).toEqual([]);
  });

  it('offers one typed issuer per purpose', () => {
    const authority = files.find((f) => f.path.endsWith('opaque-token-authority.ts'));
    for (const issuer of [
      'issuePasswordResetCredential', 'issueMfaRecoveryCredential', 'issueInvitationCredential',
      'issueEmailVerificationCredential', 'issueMembershipSelectionCredential',
      'issueRefreshCredential', 'issueMfaChallengeCredential', 'issueRegistrationStatusCredential',
      'issueMfaBackupCodeCredential', 'issueStaffAccessCredential',
    ]) {
      expect(authority?.source).toMatch(new RegExp(`export (?:const|function) ${issuer}\\b`));
    }
  });

  it('exposes no password fingerprint helper', () => {
    const crypto = files.find((f) => f.path.endsWith('auth-crypto.ts'));
    expect(crypto).toBeDefined();
    expect(crypto?.source).not.toMatch(/export\s+(?:async\s+)?function\s+hashPasswordFingerprint/);
    // The KDF import, not the word: the doc comment explains why the helper is
    // gone, and naming it there must not read as the helper still existing.
    const imports = /import\s*\{([\s\S]*?)\}\s*from\s*'crypto'/.exec(crypto?.source ?? '');
    expect(imports).not.toBeNull();
    expect(imports?.[1]).not.toMatch(/\bscrypt\b/);
  });

  it('references no password fingerprint helper anywhere', () => {
    expect(files.filter((f) => /\bhashPasswordFingerprint\b/.test(f.source)).map((f) => f.path)).toEqual([]);
  });

  it.each([
    ['hashAuthMaterial(`registration-password:${dto.password}`)'],
    ['hashAuthMaterial(stableJson({ email, passwordFingerprint }))'],
    ['hashAuthMaterial(newPassword)'],
  ])('detects the defect it was written for: %s', (reintroduced) => {
    const found = fastHashArguments(reintroduced);

    expect(found).toHaveLength(1);
    expect(CREDENTIAL_ARGUMENT.test(expressionsOnly(found[0].call))).toBe(true);
  });

  it.each([
    // The bcrypt output. Hashing that is the credential contour doing its job.
    ['sha256(user.passwordHash)'],
    // A purpose label is prose in a string, not the value being hashed.
    ['hashAuthMaterial(`password-reset:${email}`)'],
    ['hashAuthMaterial(`registration-password-policy:${policyVersion}`)'],
  ])('does not fire on a purpose label or a bcrypt output: %s', (allowed) => {
    const found = fastHashArguments(allowed);

    expect(found).toHaveLength(1);
    const argument = expressionsOnly(found[0].call).replace(/\bpasswordHash\b/g, 'bcryptOutput');
    expect(CREDENTIAL_ARGUMENT.test(argument)).toBe(false);
  });
});
