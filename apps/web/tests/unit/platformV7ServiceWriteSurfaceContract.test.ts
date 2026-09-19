import { describe, expect, it } from 'vitest';
import {
  doesPlatformV7ServiceExposeWriteMethods,
  getPlatformV7ServiceWriteMethods,
  PLATFORM_V7_REQUIRED_SERVICE_NAMES,
  PLATFORM_V7_SERVICE_WRITE_METHODS,
  type PlatformV7RequiredServiceName,
} from '@/lib/platform-v7/service-contracts';

const REQUIRED_SERVICES = [...PLATFORM_V7_REQUIRED_SERVICE_NAMES].sort();
const WRITE_SURFACE_SERVICES = Object.keys(PLATFORM_V7_SERVICE_WRITE_METHODS).sort() as PlatformV7RequiredServiceName[];

describe('platform-v7 service write surface contract', () => {
  it('keeps every required service represented in the write surface contract', () => {
    expect(WRITE_SURFACE_SERVICES).toEqual(REQUIRED_SERVICES);
  });

  it('keeps every service with at least one explicit write method', () => {
    for (const serviceName of PLATFORM_V7_REQUIRED_SERVICE_NAMES) {
      expect(doesPlatformV7ServiceExposeWriteMethods(serviceName), serviceName).toBe(true);
      expect(getPlatformV7ServiceWriteMethods(serviceName).length, serviceName).toBeGreaterThan(0);
    }
  });

  it('keeps read-only method names out of the write surface', () => {
    const methodNames = Object.values(PLATFORM_V7_SERVICE_WRITE_METHODS).flat();

    expect(methodNames).not.toContain('listSellerBatches');
    expect(methodNames).not.toContain('listLots');
    expect(methodNames).not.toContain('listBuyerRequests');
    expect(methodNames).not.toContain('listForLot');
    expect(methodNames).not.toContain('getDealSummary');
    expect(methodNames).not.toContain('getEvidencePack');
    expect(methodNames).not.toContain('getProjection');
    expect(methodNames).not.toContain('listRequirements');
    expect(methodNames).not.toContain('listOrders');
    expect(methodNames).not.toContain('listDisputes');
    expect(methodNames).not.toContain('listCases');
    expect(methodNames).not.toContain('getPartyRisk');
    expect(methodNames).not.toContain('listEntityEvents');
    expect(methodNames).not.toContain('getConnectorStatus');
  });

  it('keeps critical execution write methods explicit', () => {
    expect(getPlatformV7ServiceWriteMethods('money')).toEqual(['requestReserve', 'requestBankCheck']);
    expect(getPlatformV7ServiceWriteMethods('document')).toEqual(['attachDocument', 'markExternalStatus']);
    expect(getPlatformV7ServiceWriteMethods('logistics')).toEqual(['assignDriver', 'reportIncident']);
    expect(getPlatformV7ServiceWriteMethods('dispute')).toEqual(['openDispute', 'requestEvidence']);
    expect(getPlatformV7ServiceWriteMethods('integrations')).toEqual(['sendExternalRequest', 'receiveExternalEvent']);
  });
});
