import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

const form = read('components/platform-v7/OrganizationConnectForm.tsx');
const styles = read('components/platform-v7/OrganizationConnectForm.module.css');
const copy = read('i18n/platform-v7-organization-connect.ts');
const bff = read('app/api/platform-v7/organization-connect/route.ts');
const apiService = read('../api/src/modules/organization-intake/organization-intake.service.ts');
const migration = read('../api/prisma/migrations/20260723113000_public_organization_connection_intake/migration.sql');

describe('platform-v7 durable organization connection intake', () => {
  it('submits through a same-origin BFF and displays a server-issued receipt', () => {
    expect(form).toContain("fetch('/api/platform-v7/organization-connect'");
    expect(form).toContain("'Idempotency-Key'");
    expect(form).toContain('body.requestNumber');
    expect(form).toContain('copy.requestLabel');
    expect(form).toContain('organization_request_accepted');
    expect(form).not.toContain('window.location.assign');
    expect(form).not.toContain('staged_client_validation');
    expect(form).not.toContain('Math.random');
  });

  it('keeps personal data out of URLs, logs and analytics events', () => {
    const analyticsSlice = form.slice(form.indexOf("name: 'organization_request_accepted'"));
    expect(analyticsSlice.slice(0, 220)).not.toMatch(/email|phone|inn|contactName|organizationName/);
    expect(form).not.toMatch(/register\?[^`'\"]*(email|phone|inn|name)=/i);
    expect(bff).not.toContain('console.log');
    expect(bff).not.toContain('console.error');
    expect(bff).not.toContain("'user-agent'");
    expect(bff).toContain("body: JSON.stringify(payload)");
    expect(bff).toContain("cache: 'no-store'");
  });

  it('enforces body bounds and a server-validated honeypot', () => {
    expect(bff).toContain("Buffer.byteLength(rawBody, 'utf8')");
    expect(bff).toContain('MAX_BODY_BYTES');
    expect(form).toContain("name='website'");
    expect(form).toContain('tabIndex={-1}');
    expect(styles).toContain('.honeypot');
    expect(apiService).toContain("String(dto.website ?? '').trim()");
    expect(apiService).toContain("throw new BadRequestException('INVALID_REQUEST')");
  });

  it('uses canonical role and scenario codes in complete RU EN ZH copy', () => {
    for (const code of ['PRODUCER_SELLER', 'BUYER_PROCESSOR', 'BANK_FINANCE', 'DEAL_EXECUTION', 'FINANCE_SETTLEMENT']) {
      expect(copy).toContain(code);
    }
    expect(copy).toContain('const ru: OrganizationConnectCopy');
    expect(copy).toContain('const en: OrganizationConnectCopy');
    expect(copy).toContain('const zh: OrganizationConnectCopy');
    expect(copy).not.toContain('данные остаются в браузере');
    expect(copy).not.toContain('server endpoint');
    expect(copy).not.toContain('в реализации');
    expect(copy).not.toContain('не подтвержд');
  });

  it('binds request, audit and outbox in one serializable PostgreSQL transaction', () => {
    expect(apiService).toContain('Prisma.TransactionIsolationLevel.Serializable');
    expect(apiService).toContain('pg_advisory_xact_lock');
    expect(apiService).toContain('INSERT INTO public.audit_events');
    expect(apiService).toContain('INSERT INTO public.outbox_entries');
    expect(apiService).toContain('INSERT INTO public.public_organization_connection_requests');
    expect(apiService).toContain("this.rateLimit.consume('public_org_connect_ip'");
    expect(apiService).toContain("this.rateLimit.consume('public_org_connect_email'");
    expect(apiService).toContain('IDEMPOTENCY_PAYLOAD_MISMATCH');
    expect(apiService).toContain('correlation_id');
  });

  it('keeps personal payload and its hash out of audit and outbox events', () => {
    const eventFunction = apiService.slice(
      apiService.indexOf('function safeOperationalEvent'),
      apiService.indexOf('function isRetryableTransactionError'),
    );
    expect(eventFunction).not.toMatch(/organizationName|contactName|phone|email|inn|payloadHash/);
    expect(apiService).toContain('const payloadHash = canonicalHash(request)');
    expect(apiService).toContain('${payloadHash}');
    expect(apiService).not.toContain('payloadHash: params.payloadHash');
  });

  it('persists consent and excludes raw network inventory from the request model', () => {
    expect(migration).toContain('"consentVersion"');
    expect(migration).toContain('"consentedAt"');
    expect(migration).toContain('"payloadHash" char(64)');
    expect(migration).toContain('"idempotencyKey" varchar(128)');
    expect(migration).toContain('public_org_connection_requests_audit_fkey');
    expect(migration).toContain('public_org_connection_requests_outbox_fkey');
    expect(migration).not.toMatch(/\bip_address\b|\buser_agent\b|\bremote_addr\b/i);
    expect(migration).not.toMatch(/CREATE\s+(?:OR\s+REPLACE\s+)?(?:PROCEDURE|FUNCTION)[\s\S]*Organization/i);
  });
});
