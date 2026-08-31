import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * The repository-owned CodeQL model correction, checked from the repository
 * side.
 *
 * CodeQL itself decides whether a flow is reported; this suite guards the
 * things that would silently make the correction wrong or over-broad, which is
 * where a model correction usually goes bad:
 *
 *  - it must not become an exclusion. A model that names a file, a path, a
 *    function or a finding id stops being a statement about the world and
 *    becomes a way to hide one repository's defects;
 *  - it must keep the positive cases. The characterization fixtures pin what
 *    must still be reported, so a future edit that widens the sanitizer until
 *    real password flows disappear fails here rather than in production;
 *  - it must stay attached. A correction referenced by nothing has no effect,
 *    and an unattached file is easy to leave behind.
 */
const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..');
const MODEL = join(REPO_ROOT, 'codeql/insufficient-password-hash-corrected/OpaqueCredentialBarrier.qll');
const FIXTURES = join(REPO_ROOT, 'codeql/insufficient-password-hash-corrected/tests/negative/opaqueCredentials.js');
const CONFIG = join(REPO_ROOT, '.github/codeql/codeql-config.yml');
const WORKFLOW = join(REPO_ROOT, '.github/workflows/codeql-platform-v7-report.yml');

/**
 * Assertions about what a file *does* must not read its prose. The doc comment
 * on the model names the spec that guards it and explains which findings stay
 * high severity; stripping comments keeps the guard about the code.
 */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    // YAML comment marker, for the config and workflow.
    .replace(/(^|\s)#[^\n]*/g, '$1 ');
}

/**
 * A deliberately small YAML reader for the two shapes this file asserts on.
 * Pulling a parser in for a guard would make the guard depend on the thing it
 * is meant to check outliving a dependency change.
 */
function yamlList(source: string, key: string): string[] {
  const lines = code(source).split('\n');
  const start = lines.findIndex((line) => line.trimEnd() === `${key}:`);
  if (start < 0) return [];
  const items: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line) && line.trim()) break;
    const item = /^\s+-\s+(?:uses:\s*)?(.*\S)\s*$/.exec(line);
    if (item) items.push(item[1].replace(/^['"]|['"]$/g, ''));
  }
  return items;
}

const model = readFileSync(MODEL, 'utf8');
const modelCode = code(model);
const fixtures = readFileSync(FIXTURES, 'utf8');
const config = readFileSync(CONFIG, 'utf8');
const workflow = readFileSync(WORKFLOW, 'utf8');

describe('CodeQL password-hash model correction', () => {
  it('is attached to the analysis', () => {
    expect(config).toContain('./codeql/insufficient-password-hash-corrected/InsufficientPasswordHashCorrected.ql');
    // The guards must run the same binary that performed the analysis.
    expect(workflow).toContain('id: init');
    expect(workflow).toContain('CODEQL_BIN: ${{ steps.init.outputs.codeql-path }}');
    expect(workflow).not.toContain('CODEQL_ACTION_CLI_VERSION_INFO');
    expect(code(workflow)).not.toMatch(/^\s+codeql /m);
    expect(workflow).toContain('config-file: ./.github/codeql/codeql-config.yml');
  });

  it('extends the sanitizer rather than redefining the query', () => {
    expect(modelCode).toContain('OpaqueCredentialBarrier');
    expect(modelCode).not.toMatch(/\bfrom\b[\s\S]*\bselect\b/);
  });

  it('states a general property, naming no file, function or finding', () => {
    // The only names a correction may mention are library symbols. Anything
    // that pins it to this repository turns it into an exclusion.
    expect(modelCode).not.toMatch(/issuePasswordResetToken|resetMembershipMfa|issuePasswordResetCredential/);
    expect(modelCode).not.toMatch(/apps\/api|apps\/web|opaque-token-authority/);
    expect(modelCode).not.toMatch(/\bgetFile\b|getRelativePath|getLocation\(\)/);
    expect(modelCode).not.toMatch(/\bexclude\b|\bsuppress\b|\bignore\b/i);
  });

  it('excludes exactly one rule, and only the one it replaces', () => {
    const filters = code(config).slice(code(config).indexOf('query-filters:'));
    const excluded = filters.match(/^\s+id:\s*(\S+)/gm) ?? [];

    expect(excluded).toHaveLength(1);
    expect(excluded[0]).toContain('js/insufficient-password-hash');
    // Excluding by anything other than that single id — a tag, a path, a
    // severity band — would drop other controls with it.
    expect(filters).not.toMatch(/^\s+(tags|severity|kind):/m);
    expect(code(config)).not.toMatch(/disable-default-queries/);
  });

  it('keeps the whole default suite and adds the corrected query', () => {
    expect(code(config)).not.toMatch(/disable-default-queries/);
    expect(config).toContain('InsufficientPasswordHashCorrected.ql');
    // `packs:` takes published pack names only; a path there is ignored in
    // silence, which is how the first attempt failed without saying so.
    expect(yamlList(config, 'packs')).toEqual([]);
    expect(yamlList(config, 'queries').join(' ')).toContain('InsufficientPasswordHashCorrected.ql');
  });

  it('ignores only the query-test pack, never product source', () => {
    const ignored = yamlList(config, 'paths-ignore');

    expect(ignored).toEqual(['codeql/insufficient-password-hash-corrected/tests']);
    for (const path of ignored) {
      expect(path).not.toMatch(/^apps|^scripts|\*\*$|^\.$|^\/$/);
    }
  });

  it('carries upstream severity, precision and tags unchanged', () => {
    const query = readFileSync(join(REPO_ROOT,
      'codeql/insufficient-password-hash-corrected/InsufficientPasswordHashCorrected.ql'), 'utf8');

    expect(query).toContain('@problem.severity warning');
    expect(query).toContain('@security-severity 8.1');
    expect(query).toContain('@precision high');
    expect(query).toContain('external/cwe/cwe-916');
    expect(query).toContain('@tags security');
    expect(query).toContain('@kind path-problem');
    // Only the id may differ: two rules cannot share one identifier.
    expect(query).toContain('@id js/insufficient-password-hash-opaque-credential-aware');
  });

  it('runs without continue-on-error, so the proof can fail the job', () => {
    expect(code(workflow)).not.toMatch(/continue-on-error/);
  });

  it('inherits upstream sources, sinks and sanitizers rather than restating them', () => {
    const query = readFileSync(join(REPO_ROOT,
      'codeql/insufficient-password-hash-corrected/InsufficientPasswordHashCorrected.ql'), 'utf8');

    expect(query).toContain('InsufficientPasswordHashCustomizations::InsufficientPasswordHash');
    expect(query).toContain('source instanceof Source');
    expect(query).toContain('sink instanceof Sink');
    expect(query).toContain('node instanceof Sanitizer');
  });

  it('pins the upstream it was derived from, for drift detection', () => {
    const lock = JSON.parse(readFileSync(join(REPO_ROOT,
      'codeql/insufficient-password-hash-corrected/upstream.lock.json'), 'utf8'));
    const query = readFileSync(join(REPO_ROOT,
      'codeql/insufficient-password-hash-corrected/InsufficientPasswordHashCorrected.ql'), 'utf8');

    expect(lock.codeqlCli).toBe('2.26.4');
    expect(lock.queriesPack).toEqual({ name: 'codeql/javascript-queries', version: '2.4.4' });
    expect(lock.upstreamTag).toBe('codeql-cli/v2.26.4');
    expect(query).toContain(`Derived from the upstream query at ${lock.upstreamTag},`);
    expect(lock.upstream.query).toContain('CWE-916/InsufficientPasswordHash.ql');
    expect(lock.replacedRuleId).toBe('js/insufficient-password-hash');
    expect(lock.semanticDiff.length).toBeGreaterThan(0);
  });

  it('keys the sanitizer on entropy, not on naming', () => {
    expect(modelCode).toContain('randomBytes');
    expect(modelCode).toMatch(/getIntValue\(\)\s*>=\s*minimumEntropyBytes\(\)/);
    // 256 bits: the authority's minimum credential width. A narrower draw is
    // not accepted as opaque material, so a weakened issuer is reported again.
    expect(modelCode).toMatch(/minimumEntropyBytes\(\)\s*\{\s*result\s*=\s*32\s*\}/);
  });

  it('requires the whole chain, so no single condition can exempt a digest', () => {
    // Each of these is a conjunct of the barrier. Losing one silently would
    // widen the correction into an exclusion, which is what this pins.
    expect(modelCode).toMatch(/OpaqueFlow::flowTo\(this\)/);
    expect(modelCode).toMatch(/forall\(DataFlow::Node source \| PasswordFlow::flow\(source, this\)/);
    expect(modelCode).toMatch(/isMintingCall\(source\)/);
    // The key must not be the credential it protects. Asking whether one draw
    // feeds both the key and the pre-image is the condition; "the key is not
    // random" would be the wrong one, and would reject a correct authority.
    expect(modelCode).toMatch(/OpaqueFlow::flow\(draw, digest\.getKey\(\)\)\s*and\s*OpaqueFlow::flow\(draw, this\)/);
    expect(modelCode).toMatch(/not PasswordFlow::flowTo\(digest\.getKey\(\)\)/);
    expect(modelCode).toMatch(/isDomainSeparated\(this\)/);
    // The digest must be a keyed HMAC; a bare hash is never exempt.
    expect(modelCode).toMatch(/createHmac/);
    // A label an attacker can choose is not a fixed purpose or version.
    expect(modelCode).toMatch(/not RemoteFlow::flowTo\(node\)/);
  });

  describe('characterization fixtures', () => {
    it('pin the flows that must still be reported', () => {
      const positives = readFileSync(join(REPO_ROOT,
        'codeql/insufficient-password-hash-corrected/tests/positive/passwordFlows.js'), 'utf8');
      expect(positives).toContain("createHash('sha1').update(password");
      expect(positives).toContain("createHash('sha256').update(password");
      expect(positives).toContain("createHmac('sha256', key).update(password");
      expect(positives).toContain('passwordFingerprint: password');
    });

    it('pin the flows that must not be reported', () => {
      expect(fixtures).toContain('issuePasswordResetToken');
      expect(fixtures).toContain('issuePasswordResetCredential');
      expect(fixtures).toContain('issueMfaRecoveryCredential');
      expect(fixtures).toContain('issueRefreshCredential');
      expect(fixtures).toContain('issueMfaChallengeCredential');
      expect(fixtures).toContain('issueInvitationCredential');
      expect(fixtures).toContain('issueEmailVerificationCredential');
      expect(fixtures).toContain("randomBytes(32).toString('base64url')");
    });

    it('keeps a password-named negative case, so the model is not merely a rename', () => {
      // If the correction only worked for functions without "password" in the
      // name, renaming would have been the fix and this file would not need to
      // exist. The negative cases are deliberately password-named.
      expect(fixtures).toMatch(/function issuePasswordResetCredential/);
      expect(fixtures).toMatch(/function issuePasswordResetToken/);
    });
  });
});
