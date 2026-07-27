import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(currentFile), '../../../..');
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const webImage = read('infra/docker/Dockerfile.web');
const deployEvidence = read('scripts/write-deploy-evidence.mjs');
const seoWorkflow = read('.github/workflows/seo-live-smoke.yml');
const indexNowWorkflow = read('.github/workflows/indexnow-submit.yml');
const indexNowScript = read('scripts/indexnow-submit.mjs');
const acceptedShaWorkflow = read('.github/workflows/production-release-accepted-sha.yml');
const releaseWorkflow = read('.github/workflows/production-web-exact-sha.yml');
const securityWorkflow = read('.github/workflows/security-abuse-evidence.yml');
const securityCapture = read('scripts/security/capture-base-security-jobs.mjs');

const RELEASE_WORKFLOW_NAME = 'Production Web Exact-SHA Release';
const liveWorkflows: ReadonlyArray<readonly [string, string]> = [
  ['seo-live-smoke.yml', seoWorkflow],
  ['indexnow-submit.yml', indexNowWorkflow],
];

describe('exact-main live evidence authority', () => {
  it('binds production evidence to the immutable build commit on a public middleware-safe path', () => {
    expect(webImage).toContain('node scripts/write-deploy-evidence.mjs');
    expect(webImage).toContain('COMMIT_REF="$GIT_COMMIT"');
    expect(deployEvidence).toContain('process.env.COMMIT_REF');
    expect(deployEvidence).toContain("'apps/web/public'");
    expect(deployEvidence).toContain("'manifest-pc-deploy.json'");
    expect(deployEvidence).toContain('commitSha');
    expect(deployEvidence).not.toContain("'.well-known'");
  });

  it.each(liveWorkflows)(
    '%s runs only after an accepted exact-SHA release, never on a plain push',
    (_name, workflow) => {
      // A merge to main updates source authority. It does not deploy, so it
      // must not start anything that asserts what the live domain serves.
      expect(workflow).toContain('workflow_run:');
      expect(workflow).toContain(`workflows: ['${RELEASE_WORKFLOW_NAME}']`);
      expect(workflow).toContain('types: [completed]');
      expect(workflow).not.toMatch(/^\s{2}push:/m);

      // Only a successful release run may proceed, and only through the shared
      // resolver — neither workflow may derive the deployed SHA on its own.
      expect(workflow).toContain("github.event.workflow_run.conclusion == 'success'");
      expect(workflow).toContain('uses: ./.github/workflows/production-release-accepted-sha.yml');
      expect(workflow).toContain('release_run_id: ${{ github.event.workflow_run.id || \'\' }}');
      expect(workflow).toContain("needs.accepted.outputs.deployment_accepted == 'true'");
      expect(workflow).toContain('needs.accepted.outputs.accepted_sha');

      // github.sha is main's head under workflow_run, which is not necessarily
      // what production accepted. It must never stand in for the deployed SHA.
      expect(workflow).not.toContain('${{ github.sha }}');
      expect(workflow).not.toContain('$GITHUB_SHA');

      // Manual diagnostics stay available.
      expect(workflow).toContain('workflow_dispatch:');
      expect(workflow).toContain('manual_sha: ${{ inputs.accepted_sha || \'\' }}');
    },
  );

  it('resolves the accepted SHA fail-closed from release evidence', () => {
    expect(releaseWorkflow).toContain(`name: ${RELEASE_WORKFLOW_NAME}`);
    expect(releaseWorkflow).toContain('production-web-exact-sha-${{ github.run_id }}');

    // The resolver reads the release run's own evidence, not the event payload.
    expect(acceptedShaWorkflow).toContain('production-web-exact-sha-${{ inputs.release_run_id }}');
    expect(acceptedShaWorkflow).toContain('DEPLOYMENT_COMPLETE=');
    expect(acceptedShaWorkflow).toContain('DEPLOYED_WEB_REVISION=');

    // An audit run changes nothing on the server and must not count as a deploy.
    expect(acceptedShaWorkflow).toContain("if [ \"$action\" = 'audit' ]");
    expect(acceptedShaWorkflow).toContain("elif [ \"$complete\" != '1' ]");

    // Exact-SHA authority: a full commit id, present in this repository, on main.
    expect(acceptedShaWorkflow).toContain("grep -Eq '^[0-9a-f]{40}$'");
    expect(acceptedShaWorkflow).toContain('git cat-file -e "${accepted}^{commit}"');
    expect(acceptedShaWorkflow).toContain('git merge-base --is-ancestor "$accepted" origin/main');

    // Missing or inconclusive evidence yields false, never an assumed deploy.
    expect(acceptedShaWorkflow).toContain("echo 'deployment_accepted=false' >> \"$GITHUB_OUTPUT\"");
    expect(acceptedShaWorkflow).toContain("echo 'deployment_accepted=true' >> \"$GITHUB_OUTPUT\"");

    // Even a manual override is confirmed against the live server.
    expect(acceptedShaWorkflow).toContain('/manifest-pc-deploy.json?accepted=$ACCEPTED_SHA');
    expect(acceptedShaWorkflow).toContain('[ "$live_sha" = "$ACCEPTED_SHA" ]');
  });

  it('asserts SEO headers against the accepted release SHA', () => {
    expect(seoWorkflow).toContain('/manifest-pc-deploy.json');
    expect(seoWorkflow).toContain('test "$live_sha" = "$ACCEPTED_SHA"');
    expect(seoWorkflow).toContain('/platform-v7/secure-grain-deal');
    expect(seoWorkflow).toContain('/platform-v7/fgis-zerno');
    expect(seoWorkflow).toContain('/platform-v7/deal-flow');
    expect(seoWorkflow).toContain('seo-live-evidence.json');
    expect(seoWorkflow).toContain('seo-live-${{ needs.accepted.outputs.accepted_sha }}');
    expect(seoWorkflow).toContain('r.commitSha!==process.env.ACCEPTED_SHA');
    expect(seoWorkflow).not.toContain('seo-live-smoke-2026-07-01');
  });

  it('generates a public ownership file and submits only the accepted deployed routes', () => {
    expect(deployEvidence).toContain('const indexNowKey = process.env.INDEXNOW_KEY ||');
    expect(deployEvidence).toContain('`manifest-indexnow-${indexNowKey}.txt`');
    expect(deployEvidence).toContain('fs.writeFileSync(indexNowKeyFile, indexNowKey)');
    expect(indexNowScript).toContain('`${origin}/manifest-indexnow-${indexNowKey}.txt`');
    expect(indexNowScript).toContain('/manifest-pc-deploy.json');
    expect(indexNowScript).toContain('publicSeoAuthority.routes.map');
    expect(indexNowScript).toContain('indexnow-evidence.json');

    // Evidence must name the deployed commit, so the accepted SHA outranks
    // GITHUB_SHA rather than the other way round.
    expect(indexNowScript).toContain('commitSha: expectedDeploySha || process.env.GITHUB_SHA');

    expect(indexNowWorkflow).toContain(
      'EXPECTED_DEPLOY_SHA: ${{ needs.accepted.outputs.accepted_sha }}',
    );
    expect(indexNowWorkflow).toContain('ref: ${{ needs.accepted.outputs.accepted_sha }}');
    expect(indexNowWorkflow).toContain('indexnow-${{ needs.accepted.outputs.accepted_sha }}');
    expect(indexNowWorkflow).toContain('r.commitSha!==process.env.ACCEPTED_SHA');
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
