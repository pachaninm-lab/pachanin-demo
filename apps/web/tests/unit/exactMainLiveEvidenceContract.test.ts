import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const netlifyConfig = read('netlify.toml');
const deployEvidence = read('scripts/write-deploy-evidence.mjs');
const seoWorkflow = read('.github/workflows/seo-live-smoke.yml');
const indexNowWorkflow = read('.github/workflows/indexnow-submit.yml');
const indexNowScript = read('scripts/indexnow-submit.mjs');
const securityWorkflow = read('.github/workflows/security-abuse-evidence.yml');
const securityCapture = read('scripts/security/capture-base-security-jobs.mjs');
const indexNowKey = 'a7a2b84a1d594be0b7648166c4c4cf26';

describe('exact-main live evidence authority', () => {
  it('binds Netlify production evidence to the immutable build commit', () => {
    expect(netlifyConfig).toContain('node scripts/write-deploy-evidence.mjs');
    expect(deployEvidence).toContain('process.env.COMMIT_REF');
    expect(deployEvidence).toContain("'apps/web/public/.well-known'");
    expect(deployEvidence).toContain("'pc-deploy.json'");
    expect(deployEvidence).toContain('commitSha');
  });

  it('waits for the exact production SHA before asserting SEO headers', () => {
    expect(seoWorkflow).toContain('/.well-known/pc-deploy.json');
    expect(seoWorkflow).toContain('live_sha\" == \"$GITHUB_SHA');
    expect(seoWorkflow).toContain('/platform-v7/secure-grain-deal');
    expect(seoWorkflow).toContain('/platform-v7/fgis-zerno');
    expect(seoWorkflow).toContain('/platform-v7/deal-flow');
    expect(seoWorkflow).toContain('seo-live-evidence.json');
    expect(seoWorkflow).toContain('seo-live-${{ github.sha }}');
    expect(seoWorkflow).not.toContain('seo-live-smoke-2026-07-01');
  });

  it('uses the protocol root key file and exact deployed public route authority for IndexNow', () => {
    const rootKeyFile = read(`apps/web/public/${indexNowKey}.txt`);
    expect(rootKeyFile).toBe(indexNowKey);
    expect(indexNowScript).toContain('`${origin}/${indexNowKey}.txt`');
    expect(indexNowScript).toContain('/.well-known/pc-deploy.json');
    expect(indexNowScript).toContain('publicSeoAuthority.routes.map');
    expect(indexNowScript).toContain('indexnow-evidence.json');
    expect(indexNowWorkflow).toContain('EXPECTED_DEPLOY_SHA: ${{ github.sha }}');
    expect(indexNowWorkflow).toContain('indexnow-${{ github.sha }}');
  });

  it('derives Security Quality job authority from exact-head GraphQL checks', () => {
    expect(securityWorkflow).toContain('node scripts/security/capture-base-security-jobs.mjs');
    expect(securityWorkflow).not.toContain('gh run list');
    expect(securityWorkflow).not.toContain('gh run view');
    expect(securityCapture).toContain('statusCheckRollup');
    expect(securityCapture).toContain("'Security Quality Gate'");
    expect(securityCapture).toContain("'Secrets · Gitleaks blocking'");
    expect(securityCapture).toContain("'TypeScript · strict blocking'");
    expect(securityCapture).toContain('BASE_SECURITY_RUN_ID=');
  });
});
