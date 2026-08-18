import { readFileSync } from 'fs';
import { join } from 'path';
import { summarizeIntegrationPayload } from './integration-event-redaction.policy';

const migrationPath = join(
  __dirname,
  '..',
  '..',
  '..',
  'prisma',
  'migrations',
  '20260818183000_pc_crop_integration_event_safe_telemetry',
  'migration.sql',
);
const migration = readFileSync(migrationPath, 'utf8');

describe('integration event PostgreSQL redaction guard contract', () => {
  it('keeps the database guard aligned with every metadata kind emitted by the service', () => {
    const kinds = new Set([
      summarizeIntegrationPayload(null)?.kind,
      summarizeIntegrationPayload(1)?.kind,
      summarizeIntegrationPayload(true)?.kind,
      summarizeIntegrationPayload(Symbol('other'))?.kind,
      summarizeIntegrationPayload([])?.kind,
      summarizeIntegrationPayload({})?.kind,
      summarizeIntegrationPayload('value')?.kind,
    ]);

    expect(kinds).toEqual(
      new Set(['NULL', 'NUMBER', 'BOOLEAN', 'OTHER', 'ARRAY', 'OBJECT', 'STRING']),
    );
    for (const kind of kinds) {
      expect(migration).toContain(`'${kind}'`);
    }
  });

  it('puts a database check behind request, response and free-text error telemetry', () => {
    expect(migration).toContain('integration_events_request_payload_safe_ck');
    expect(migration).toContain('integration_events_response_payload_safe_ck');
    expect(migration).toContain('integration_events_error_message_safe_ck');
    expect(migration).toContain('pc_crop_integration_event_safe_payload');
  });

  it('uses NOT VALID so historical evidence is not rewritten or retroactively rejected', () => {
    const constraintAdds = migration.match(/ADD CONSTRAINT[\s\S]*?NOT VALID;/g) ?? [];
    expect(constraintAdds).toHaveLength(3);
    expect(migration).not.toMatch(/VALIDATE\s+CONSTRAINT/iu);
    expect(migration).not.toMatch(/UPDATE\s+public\."integration_events"/iu);
    expect(migration).not.toMatch(/DELETE\s+FROM\s+public\."integration_events"/iu);
  });

  it('bounds structural counts to the same limits as the application redactor', () => {
    expect(migration).toContain('BETWEEN 0 AND 1000000');
    expect(migration).toContain('BETWEEN 0 AND 10000000');
  });

  it('allows only bounded machine-safe error codes for new rows', () => {
    expect(migration).toContain("'^[A-Z][A-Z0-9_.:-]{0,95}$'");
    expect(migration).not.toContain('errorMessage IS NOT NULL THEN true');
  });

  it('does not introduce a second telemetry table', () => {
    expect(migration).not.toMatch(/CREATE\s+TABLE/iu);
    expect(migration).toContain('ALTER TABLE public."integration_events"');
  });
});
