import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const route = read('apps/web/app/api/restricted-public-platform-assistant/route.ts');
const activation = read('.github/workflows/tai-restricted-qwen-reg-ru-activation.yml');
const deployment = read('.github/workflows/tai-reg-ru-deploy.yml');
const deployContract = read('scripts/check-tai-reg-ru-deploy.mjs');

describe('TAI restricted Qwen production truth', () => {
  it('does not cap real model inference at eight seconds', () => {
    expect(route).not.toContain('FAST_FALLBACK_TIMEOUT_MS');
    expect(route).toContain('runtimeConfig.timeoutMs,');
    expect(route).not.toContain('Math.min(runtimeConfig.timeoutMs');
  });

  it('requires exact local-Qwen RU EN ZH evidence before activation PASS', () => {
    expect(activation).toContain("summary.get('source') == 'local_qwen'");
    expect(activation).toContain("summary.get('modelIdentity') == 'tai-qwen3-8b-q4km'");
    expect(activation).toContain("'MODEL_FAST_FALLBACK' not in safety_flags");
    expect(activation).toContain("'MODEL_RUNTIME_UNAVAILABLE' not in safety_flags");
    expect(activation).toContain("assessment.get('operationalStatus') == 'NOT_ATTESTED'");
  });

  it('keeps permanently admitted standalone TAI deployment manual and fail closed', () => {
    expect(deployment).not.toContain('workflows: ["TAI Restricted Qwen REG.RU Activation"]');
    expect(deployment).not.toMatch(/workflow_run:\s*[\s\S]*TAI Restricted Qwen REG\.RU Activation/u);
    expect(deployment).toContain('workflow_dispatch:');
    expect(deployment).toContain("inputs.confirmation == 'DEPLOY-TAI-REG-RU'");
    expect(deployment).toContain('Permanent model admission is required');
    expect(deployContract).toContain('restricted activation must not auto-deploy standalone TAI');
  });
});
