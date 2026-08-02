import { ForbiddenException } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { FgisStepService } from './fgis-step.service';
import { FGIS_LEGACY_ERROR_CODES } from '../regulatory-integration/fgis-grain/fgis-grain-legacy-quarantine';
import { RecordingFgisQuarantineAudit } from '../regulatory-integration/fgis-grain/fgis-grain-legacy-quarantine.test-double';
import type { RequestUser } from '../../common/types/request-user';

const actor: RequestUser = {
  id: 'user-staff-1',
  orgId: 'org-platform',
  tenantId: 'tenant-one',
  role: 'SUPPORT_MANAGER',
  email: 'staff@example.test',
  sessionId: 'session-staff-1',
};

/**
 * P0.2-1A regression guard. Platform staff must not be able to perform a
 * legally significant ФГИС «Зерно» act for a participating organization, and no
 * production code path may reach the mock adapter.
 */
describe('FgisStepService — retired ФГИС «Зерно» saga steps', () => {
  let service: FgisStepService;
  let audit: RecordingFgisQuarantineAudit;

  beforeEach(() => {
    audit = new RecordingFgisQuarantineAudit();
    service = new FgisStepService(audit.asService());
  });

  const registerParams = {
    dealId: 'DEAL-1',
    culture: 'wheat',
    cropClass: '3',
    volumeTons: 500,
    producerInn: '7707083893',
    regionCode: '68',
    gost: 'ГОСТ 9353-2016',
  };

  async function denialOf(run: () => Promise<unknown>): Promise<ForbiddenException> {
    try {
      await run();
    } catch (error) {
      return error as ForbiddenException;
    }
    throw new Error('the retired saga step must not resolve');
  }

  it('refuses lot registration performed by staff', async () => {
    const error = await denialOf(() => service.executeFgisRegister(registerParams, actor));
    expect(error).toBeInstanceOf(ForbiddenException);
    const body = error.getResponse() as Record<string, unknown>;
    expect(body.code).toBe(FGIS_LEGACY_ERROR_CODES.SAGA_RETIRED);
    expect(body.stateChanged).toBe(false);
    // The old path answered with an invented ФГИС lot id and certificate.
    expect(body).not.toHaveProperty('fgisLotId');
    expect(body).not.toHaveProperty('certificate');
  });

  it('refuses shipment confirmation performed by staff', async () => {
    const error = await denialOf(() =>
      service.confirmShipment({
        dealId: 'DEAL-1',
        fgisLotId: 'FGIS-1',
        vehicleNumber: 'A123AA68',
        driverName: 'Иванов И.И.',
        routeFrom: 'Тамбов',
        routeTo: 'Новороссийск',
        loadedTons: 60,
      }, actor),
    );
    expect((error.getResponse() as { code: string }).code).toBe(
      FGIS_LEGACY_ERROR_CODES.SAGA_RETIRED,
    );
  });

  it('refuses acceptance confirmation performed by staff', async () => {
    const error = await denialOf(() =>
      service.confirmAcceptance({
        dealId: 'DEAL-1',
        fgisLotId: 'FGIS-1',
        receiverInn: '7707083893',
        acceptedTons: 60,
        quality: { protein: 13.1 },
      }, actor),
    );
    expect((error.getResponse() as { code: string }).code).toBe(
      FGIS_LEGACY_ERROR_CODES.SAGA_RETIRED,
    );
  });

  it('refuses the synthetic crop dictionary', async () => {
    const error = await denialOf(() => service.getCrops(actor));
    expect((error.getResponse() as { code: string }).code).toBe(
      FGIS_LEGACY_ERROR_CODES.SAGA_RETIRED,
    );
  });

  it('never leaves the deal saga advanced, completed or failed', async () => {
    // The service no longer holds a saga reference at all, which is what makes
    // "denied without writing deal history" structurally true rather than a
    // property some future edit could quietly drop.
    expect(Object.values(service)).not.toContainEqual(
      expect.objectContaining({ advance: expect.any(Function) }),
    );
  });

  it('does not reach the integration registry from the production module graph', () => {
    const source = readFileSync(join(__dirname, 'fgis-step.service.ts'), 'utf8');
    // Import statements only — the file may still name the registry in prose
    // explaining why it is no longer wired in.
    const imports = source
      .split('\n')
      .filter((line) => /^\s*import\b/.test(line) || /\brequire\(/.test(line))
      .join('\n');
    expect(imports).not.toMatch(/integration-sdk/);
    expect(imports).not.toMatch(/integrationRegistry/);
    expect(imports).not.toMatch(/MockFgisZernoAdapter/);
  });
});
