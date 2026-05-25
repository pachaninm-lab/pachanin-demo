import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function webPath(path: string): string {
  return join(process.cwd(), path);
}

function readWebFile(path: string): string {
  return readFileSync(webPath(path), 'utf8');
}

const stage5RuntimeFiles = [
  'lib/platform-v7/runtime/application-service.ts',
  'lib/platform-v7/runtime/application-service-types.ts',
  'lib/platform-v7/runtime/dto-schemas.ts',
  'lib/platform-v7/runtime/mock-persistence-adapter.ts',
  'lib/platform-v7/runtime/persistence-ports.ts',
  'app/platform-v7/actions/runtime-actions.ts',
  'tests/unit/platformV7RuntimeServerActions.test.ts',
  'tests/unit/platformV7RuntimeIntegration.test.ts',
] as const;

const forbiddenRuntimeImports = [
  'apps/landing',
  'components/platform-v7',
  'components/v7r',
  'lib/platform-v7/adapters',
  'lib/platform-v7/ai',
  'app/api',
] as const;

const forbiddenLiveCalls = [
  'fetch(',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'axios.',
  'bank connected',
  'fgis connected',
  'edo connected',
] as const;

describe('platform-v7 Stage 5 final runtime QA', () => {
  it('keeps the complete Stage 5 runtime file set present after merge', () => {
    stage5RuntimeFiles.forEach((path) => {
      expect(existsSync(webPath(path)), path).toBe(true);
    });
  });

  it('keeps runtime server actions as wrappers over application services', () => {
    const source = readWebFile('app/platform-v7/actions/runtime-actions.ts');

    expect(source).toContain('createP7RuntimeServerActions');
    expect(source).toContain('createP7MoneyExecutionService');
    expect(source).toContain('createP7DocumentExecutionService');
    expect(source).toContain('createP7BankBasisExecutionService');
    expect(source).toContain('createP7ReleaseWorkflowService');
    expect(source).toContain('createP7DisputeSettlementService');
    expect(source).toContain('validateP7RuntimeRequestBaseDto');
    expect(source).toContain('duplicateBeforeCall');
    expect(source).toContain('auditPayloads');
  });

  it('keeps runtime server actions isolated from UI, adapters and live network calls', () => {
    const source = readWebFile('app/platform-v7/actions/runtime-actions.ts');

    [...forbiddenRuntimeImports, ...forbiddenLiveCalls].forEach((forbidden) => {
      expect(source).not.toContain(forbidden);
    });
  });

  it('keeps application services behind persistence ports and deterministic result contracts', () => {
    const service = readWebFile('lib/platform-v7/runtime/application-service.ts');
    const types = readWebFile('lib/platform-v7/runtime/application-service-types.ts');

    expect(service).toContain('P7RuntimeTransactionalPorts');
    expect(service).toContain('unitOfWork');
    expect(service).toContain('idempotency');
    expect(service).toContain('audit');
    expect(service).toContain('expectedVersion');
    expect(types).toContain('validation_error');
    expect(types).toContain('duplicate');
    expect(types).toContain('conflict');
    expect(types).toContain('domain_blocked');
  });

  it('keeps DTO validation, mock persistence and runtime integration coverage aligned', () => {
    const dtoSchemas = readWebFile('lib/platform-v7/runtime/dto-schemas.ts');
    const mockStore = readWebFile('lib/platform-v7/runtime/mock-persistence-adapter.ts');
    const integrationTest = readWebFile('tests/unit/platformV7RuntimeIntegration.test.ts');

    expect(dtoSchemas).toContain('validateP7ReleaseRequestDto');
    expect(dtoSchemas).toContain('validateP7BankBasisSendRequestDto');
    expect(dtoSchemas).toContain('validateP7BankConfirmationRequestDto');
    expect(mockStore).toContain('createP7MockRuntimeStore');
    expect(mockStore).toContain('simulateNextConflict');
    expect(integrationTest).toContain('server wrapper');
    expect(integrationTest).toContain('application service');
    expect(integrationTest).toContain('mock-persistence-adapter');
    expect(integrationTest).toContain('validation_error');
    expect(integrationTest).toContain('duplicate');
    expect(integrationTest).toContain('conflict');
  });
});
