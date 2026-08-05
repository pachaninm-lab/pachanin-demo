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
const MODEL = join(REPO_ROOT, 'codeql/platform-v7-customizations/semmle/javascript/Customizations.qll');
const FIXTURES = join(REPO_ROOT, 'codeql/platform-v7-customizations/fixtures/password-hash-model-fixtures.js');
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

const model = readFileSync(MODEL, 'utf8');
const modelCode = code(model);
const fixtures = readFileSync(FIXTURES, 'utf8');
const config = readFileSync(CONFIG, 'utf8');
const workflow = readFileSync(WORKFLOW, 'utf8');

describe('CodeQL password-hash model correction', () => {
  it('is attached to the analysis', () => {
    expect(config).toContain('./codeql/platform-v7-customizations');
    expect(workflow).toContain('config-file: ./.github/codeql/codeql-config.yml');
  });

  it('extends the sanitizer rather than redefining the query', () => {
    expect(modelCode).toContain('InsufficientPasswordHash::Sanitizer');
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

  it('changes no severity and disables nothing', () => {
    for (const text of [modelCode, code(config), code(workflow)]) {
      expect(text).not.toMatch(/severity/i);
      expect(text).not.toMatch(/query-filters|paths-ignore|disable-default-queries/);
    }
  });

  it('keys the sanitizer on entropy, not on naming', () => {
    expect(modelCode).toContain('randomBytes');
    expect(modelCode).toMatch(/getIntValue\(\)\s*>=\s*minBytes/);
    // 128 bits is the floor below which a digest's cost would start to matter.
    expect(modelCode).toContain('isCsprngBytes(result, 16)');
  });

  describe('characterization fixtures', () => {
    it('pin the flows that must still be reported', () => {
      expect(fixtures).toContain("createHash('sha256').update(password");
      expect(fixtures).toContain("createHmac('sha256', key).update(password");
      expect(fixtures).toContain('passwordFingerprint: password');
    });

    it('pin the flows that must not be reported', () => {
      expect(fixtures).toContain('issuePasswordResetToken');
      expect(fixtures).toContain('issuePasswordResetCredential');
      expect(fixtures).toContain('issueMfaBackupCode');
      expect(fixtures).toContain("randomBytes(32).toString('base64url')");
      expect(fixtures).toMatch(/v1:\$\{createHmac/);
    });

    it('keeps a password-named negative case, so the model is not merely a rename', () => {
      // If the correction only worked for functions without "password" in the
      // name, renaming would have been the fix and this file would not need to
      // exist. The negative cases are deliberately password-named.
      const negatives = fixtures.slice(fixtures.indexOf('NEGATIVE 1'));
      expect(negatives).toMatch(/function issuePasswordReset/);
    });
  });
});
