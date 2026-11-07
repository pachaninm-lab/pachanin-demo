import {
  assertOrganizationCapabilityReplay,
  organizationCapabilityCommandFingerprint,
  OrganizationCapabilityCommandValidationError,
  type OrganizationCapabilityCommand,
} from './organization-capability-command.contract';
import {
  declaredOrganizationCapabilityStatus,
  ORGANIZATION_CAPABILITY_CODES,
  ORGANIZATION_CAPABILITY_REGISTRY,
  organizationCapabilityRequiresVerification,
} from './organization-capability.registry';
import { parseOrganizationCapabilityIfMatch } from './organization-capabilities.controller';
import { validateSync } from 'class-validator';
import { ExecuteOrganizationCapabilityCommandDto } from './dto/organization-capability-api.dto';

function command(overrides: Partial<OrganizationCapabilityCommand> = {}): OrganizationCapabilityCommand {
  return {
    commandId: 'org-cap-command-001',
    idempotencyKey: 'org-cap-idempotency-001',
    correlationId: 'org-cap-correlation-001',
    capabilityCode: 'SELL_CROP',
    action: 'DECLARE',
    expectedVersion: '0',
    reason: 'Организация декларирует продажу продукции.',
    ...overrides,
  };
}

describe('organization capability registry and command contract', () => {
  it('contains exactly the 13 canonical codes without duplicates', () => {
    expect(ORGANIZATION_CAPABILITY_CODES).toHaveLength(13);
    expect(new Set(ORGANIZATION_CAPABILITY_CODES).size).toBe(13);
    expect(ORGANIZATION_CAPABILITY_REGISTRY.map((item) => item.code))
      .toEqual(ORGANIZATION_CAPABILITY_CODES);
  });

  it('never self-activates provider or integration capabilities', () => {
    expect(declaredOrganizationCapabilityStatus('SELL_CROP')).toBe('ACTIVE');
    expect(declaredOrganizationCapabilityStatus('STORE_CROP')).toBe('ACTIVE');
    for (const code of ORGANIZATION_CAPABILITY_CODES.filter(organizationCapabilityRequiresVerification)) {
      expect(declaredOrganizationCapabilityStatus(code)).toBe('PENDING_VERIFICATION');
    }
    expect(ORGANIZATION_CAPABILITY_CODES.filter(organizationCapabilityRequiresVerification))
      .toHaveLength(9);
  });

  it('binds an idempotency replay to the whole command payload', () => {
    const original = command();
    const fingerprint = organizationCapabilityCommandFingerprint(original);
    expect(() => assertOrganizationCapabilityReplay(fingerprint, original)).not.toThrow();
    expect(() => assertOrganizationCapabilityReplay(fingerprint, command({
      reason: 'Другой смысл команды с тем же ключом идемпотентности.',
    }))).toThrow('IDEMPOTENCY_PAYLOAD_MISMATCH');
  });

  it('requires bounded identifiers, a human reason and a CAS version', () => {
    expect(() => organizationCapabilityCommandFingerprint(command({ expectedVersion: '-1' })))
      .toThrow(OrganizationCapabilityCommandValidationError);
    expect(() => organizationCapabilityCommandFingerprint(command({ reason: 'short' })))
      .toThrow(OrganizationCapabilityCommandValidationError);
  });

  it('parses strong and weak ETags but rejects missing or malformed If-Match', () => {
    expect(parseOrganizationCapabilityIfMatch('"12"')).toBe('12');
    expect(parseOrganizationCapabilityIfMatch('W/"12"')).toBe('12');
    expect(parseOrganizationCapabilityIfMatch('0')).toBe('0');
    expect(() => parseOrganizationCapabilityIfMatch(undefined)).toThrow();
    expect(() => parseOrganizationCapabilityIfMatch('12.0')).toThrow();
  });

  it('rejects every client-controlled authority field', () => {
    const dto = Object.assign(new ExecuteOrganizationCapabilityCommandDto(), {
      commandId: 'org-cap-command-002',
      idempotencyKey: 'org-cap-idempotency-002',
      correlationId: 'org-cap-correlation-002',
      reason: 'A sufficiently long human reason.',
      tenantId: 'forged-tenant',
      orgId: 'forged-org',
      membershipId: 'forged-membership',
      role: 'ADMIN',
      status: 'ACTIVE',
      requiresVerification: false,
      expectedVersion: '999',
    });
    const fields = validateSync(dto).flatMap((error) => error.property);
    expect(fields).toEqual(expect.arrayContaining([
      'tenantId',
      'orgId',
      'membershipId',
      'role',
      'status',
      'requiresVerification',
      'expectedVersion',
    ]));
  });
});
