import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const productionConfig = read('playwright.production-mobile.config.ts');
const productionWorkflow = read('../../.github/workflows/platform-v7-production-mobile-acceptance.yml');

describe('Gekta production browser evidence contract', () => {
  it('runs the exact production mobile suite on Chromium and WebKit without retries', () => {
    expect(productionConfig).toContain('retries: 0');
    expect(productionConfig).toContain("name: 'production-mobile-chromium'");
    expect(productionConfig).toContain("browserName: 'chromium'");
    expect(productionConfig).toContain("name: 'production-mobile-webkit'");
    expect(productionConfig).toContain("browserName: 'webkit'");
    expect(productionConfig).not.toContain("projects: [{ name: 'production-mobile-chromium' }]");
  });

  it('installs both engines and retains independent evidence for every clean rerun', () => {
    expect(productionWorkflow).toContain('Install Chromium and WebKit runtimes');
    expect(productionWorkflow).toContain('playwright install --with-deps chromium webkit');
    expect(productionWorkflow).toContain('browser engines: \\`Chromium + WebKit\\`');
    expect(productionWorkflow).toContain('workflow run attempt: \\`$GITHUB_RUN_ATTEMPT\\`');
    expect(productionWorkflow).toContain(
      'platform-v7-production-mobile-${{ github.run_id }}-attempt-${{ github.run_attempt }}',
    );
    expect(productionWorkflow).toContain("printf '%s\\n' 'chromium' 'webkit'");
  });
});
