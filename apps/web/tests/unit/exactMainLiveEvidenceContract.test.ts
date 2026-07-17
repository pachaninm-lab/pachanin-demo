import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(currentFile), '../../../..');
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const netlifyConfig = read('netlify.toml');
const deployEvidence = read('scripts/write-deploy-evidence.mjs');
const seoWorkflow = read('.github/workflows/seo-live-smoke.yml');
const indexNowWorkflow = read('.github/workflows/indexnow-submit.yml');
const indexNowScript = read('scripts/indexnow-submit.mjs');
const securityWorkflow = read('.github/workflows/security-abuse-evidence.yml');
const securityCapture = read('scripts/security/capture-base-security-jobs.mjs');

describe('exact-main live evidence authority', () => {
  it('binds Netlify production evidence to the immutable build commit on a public middleware-safe path', () => {
    expect(netlifyConfig).toContain('node scripts/write-deploy-evidence.mjs');
    expect(deployEvidence).toContain('process.env.COMMIT_REF');
    expect(deployEvidence).toContain("'apps/web/public'");
    expect(deployEvidence).toContain("'manifest-pc-deploy.json'");
    expect(deployEvidence).toContain('commitSha');
    expect(deployEvidence).not.toContain("'.well-known'");
  });

  it('waits for the exact production SHA before asserting SEO headers', () => {
    expect(seoWorkflow).toContain('/manifest-pc-deploy.json');
    expect(seoWorkflow).toContain('live_sha" == "$GITHUB_SHA');
    expect(seoWorkflow).toContain('/platform-v7/secure-grain-deal');
    expect(seoWorkflow).toContain('/platform-v7/fgis-zerno');
    expect(seoWorkflow).toContain('/platform-v7/deal-flow');
    expect(seoWorkflow).toContain('seo-live-evidence.json');
    expect(seoWorkflow).toContain('seo-live-${{ github.sha }}');
    expect(seoWorkflow).not.toContain('seo-live-smoke-2026-07-01');
  });

  it('generates a public ownership file and submits only exact deployed public routes', () => {
    expect(deployEvidence).toContain('const indexNowKey = process.env.INDEXNOW_KEY ||');
    expect(deployEvidence).toContain('`manifest-indexnow-${indexNowKey}.txt`');
    expect(deployEvidence).toContain('fs.writeFileSync(indexNowKeyFile, indexNowKey)');
    expect(indexNowScript).toContain('`${origin}/manifest-indexnow-${indexNowKey}.txt`');
    expect(indexNowScript).toContain('/manifest-pc-deploy.json');
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
