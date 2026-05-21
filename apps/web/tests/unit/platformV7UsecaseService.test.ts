import { describe, expect, it } from 'vitest';
import { p7EvaluateUsecase, type P7UsecaseRequest } from '@/lib/platform-v7/usecase-service';

const baseRequest: P7UsecaseRequest = {
  usecaseId: 'request_money_release',
  method: 'POST',
  path: '/api/deals/{id}/money/release-request',
  idempotencyKey: 'idem-1',
  correlationId: 'corr-1',
  auditId: 'audit-1',
  access: {
    actor: { userId: 'user-1', organizationId: 'seller-1', roles: ['seller'], activeRole: 'seller' },
    action: 'request',
    resource: { resourceType: 'money', resourceId: 'money-1', sellerOrganizationId: 'seller-1' },
  },
  releaseGate: {
    dealStatus: 'release_basis_ready',
    moneyStatus: 'reserved',
    requiredDocumentsConfirmed: true,
    tripStatus: 'completed',
    acceptanceStatus: 'confirmed',
    disputeStatus: 'none',
    bankReviewStatus: 'clear',
  },
};

describe('platform-v7 usecase service', () => {
  it('allows a traced, idempotent and access-approved release request when gates pass', () => {
    expect(p7EvaluateUsecase(baseRequest).allowed).toBe(true);
  });

  it('requires registered endpoint contracts', () => {
    expect(p7EvaluateUsecase({ ...baseRequest, path: '/api/unknown' }).auditCode).toBe('ENDPOINT_NOT_REGISTERED');
  });

  it('requires idempotency key for critical endpoints', () => {
    expect(p7EvaluateUsecase({ ...baseRequest, idempotencyKey: undefined }).auditCode).toBe('IDEMPOTENCY_REQUIRED');
  });

  it('requires trace ids', () => {
    expect(p7EvaluateUsecase({ ...baseRequest, correlationId: '' }).auditCode).toBe('TRACE_REQUIRED');
  });

  it('blocks usecase when access policy denies object scope', () => {
    expect(p7EvaluateUsecase({
      ...baseRequest,
      access: {
        ...baseRequest.access,
        resource: { resourceType: 'money', resourceId: 'money-1', sellerOrganizationId: 'seller-2' },
      },
    }).auditCode).toBe('DENY_BY_DEFAULT');
  });

  it('blocks money release when release gate is not ready', () => {
    expect(p7EvaluateUsecase({
      ...baseRequest,
      releaseGate: { ...baseRequest.releaseGate!, requiredDocumentsConfirmed: false },
    }).auditCode).toBe('RELEASE_GATE_BLOCKED');
  });
});
