import { UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'crypto';
import {
  canonicalTaiToolJson,
  canonicalTaiToolRequestSha256,
  TaiToolAssertionVerifier,
} from './tai-tool-assertion';

const SECRET = Buffer.alloc(32, 7);
const NOW = new Date('2026-07-19T02:00:00.000Z');
const PATH = '/api/internal/tai/tools/getDealSummary';
const BODY = { arguments: { dealId: 'deal-2408' } };
const IDEMPOTENCY = 'tai.tool.request.0001';

function signedAssertion(overrides: Record<string, unknown> = {}) {
  const payload = {
    audience: 'platform-api',
    call_id: 'call-1',
    expires_at: '2026-07-19T02:00:20.000Z',
    idempotency_key: IDEMPOTENCY,
    issued_at: '2026-07-19T02:00:00.000Z',
    mode: 'READ_ONLY',
    request_sha256: canonicalTaiToolRequestSha256({
      method: 'POST',
      path: PATH,
      payload: BODY,
      idempotencyKey: IDEMPOTENCY,
    }),
    schema_version: 'tai.platform-tool.v1',
    session_id: '22222222-2222-4222-8222-222222222222',
    tenant_id: '33333333-3333-4333-8333-333333333333',
    tool_name: 'getDealSummary',
    trace_id: '44444444-4444-4444-8444-444444444444',
    user_id: '55555555-5555-4555-8555-555555555555',
    ...overrides,
  };
  const canonical = Buffer.from(canonicalTaiToolJson(payload));
  return {
    assertion: canonical.toString('base64url'),
    signature: createHmac('sha256', SECRET).update(canonical).digest('hex'),
  };
}

describe('TaiToolAssertionVerifier', () => {
  beforeEach(() => {
    process.env.TAI_PLATFORM_TOOL_HMAC_SECRET_B64 = SECRET.toString('base64');
  });

  afterEach(() => {
    delete process.env.TAI_PLATFORM_TOOL_HMAC_SECRET_B64;
  });

  it('accepts an exact request-bound delegated identity', () => {
    const verifier = new TaiToolAssertionVerifier();
    const signed = signedAssertion();
    const identity = verifier.verify({
      ...signed,
      toolName: 'getDealSummary',
      method: 'POST',
      path: PATH,
      body: BODY,
      idempotencyKey: IDEMPOTENCY,
      now: NOW,
    });

    expect(identity).toMatchObject({
      toolName: 'getDealSummary',
      mode: 'READ_ONLY',
      idempotencyKey: IDEMPOTENCY,
      userId: '55555555-5555-4555-8555-555555555555',
      tenantId: '33333333-3333-4333-8333-333333333333',
    });
  });

  it('accepts only the registered confirmed mode for assignLogistics', () => {
    const verifier = new TaiToolAssertionVerifier();
    const path = '/api/internal/tai/tools/assignLogistics';
    const body = {
      arguments: {
        dealId: 'deal-2408',
        carrierOrgId: 'carrier-1',
        driverUserId: 'driver-1',
        vehicleId: 'vehicle-1',
        routeFromFacilityId: 'facility-1',
        routeToFacilityId: 'facility-2',
        expectedUpdatedAt: '2026-07-19T01:59:00.000Z',
        expectedVersion: '7',
      },
    };
    const signed = signedAssertion({
      tool_name: 'assignLogistics',
      mode: 'CONFIRMED_WRITE',
      request_sha256: canonicalTaiToolRequestSha256({
        method: 'POST',
        path,
        payload: body,
        idempotencyKey: IDEMPOTENCY,
      }),
    });

    expect(
      verifier.verify({
        ...signed,
        toolName: 'assignLogistics',
        method: 'POST',
        path,
        body,
        idempotencyKey: IDEMPOTENCY,
        now: NOW,
      }),
    ).toMatchObject({
      toolName: 'assignLogistics',
      mode: 'CONFIRMED_WRITE',
    });

    const rebound = signedAssertion({
      tool_name: 'assignLogistics',
      mode: 'DRAFT',
      request_sha256: canonicalTaiToolRequestSha256({
        method: 'POST',
        path,
        payload: body,
        idempotencyKey: IDEMPOTENCY,
      }),
    });
    expect(() =>
      verifier.verify({
        ...rebound,
        toolName: 'assignLogistics',
        method: 'POST',
        path,
        body,
        idempotencyKey: IDEMPOTENCY,
        now: NOW,
      }),
    ).toThrow(UnauthorizedException);
  });

  it('rejects body rebinding and expired assertions', () => {
    const verifier = new TaiToolAssertionVerifier();
    const signed = signedAssertion();

    expect(() =>
      verifier.verify({
        ...signed,
        toolName: 'getDealSummary',
        method: 'POST',
        path: PATH,
        body: { arguments: { dealId: 'other-deal' } },
        idempotencyKey: IDEMPOTENCY,
        now: NOW,
      }),
    ).toThrow(UnauthorizedException);

    const expired = signedAssertion({
      issued_at: '2026-07-19T01:58:00.000Z',
      expires_at: '2026-07-19T01:58:20.000Z',
    });
    expect(() =>
      verifier.verify({
        ...expired,
        toolName: 'getDealSummary',
        method: 'POST',
        path: PATH,
        body: BODY,
        idempotencyKey: IDEMPOTENCY,
        now: NOW,
      }),
    ).toThrow(UnauthorizedException);
  });
});
