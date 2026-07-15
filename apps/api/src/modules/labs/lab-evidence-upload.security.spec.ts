import { BadRequestException } from '@nestjs/common';
import { Role, type RequestUser } from '../../common/types/request-user';
import { LabEvidenceUploadService } from './lab-evidence-upload.service';

const ADMIN: RequestUser = {
  id: 'security-upload-admin',
  email: 'security-upload-admin@test.invalid',
  role: Role.ADMIN,
  orgId: 'org-platform',
  tenantId: 'tenant-security',
  sessionId: 'security-upload-session',
  mfaVerified: true,
};

const BASE_REQUEST = {
  purpose: 'LAB_AUTHORITY' as const,
  dealId: 'deal-security-upload',
  laboratoryOrgId: 'org-security-lab',
  filename: 'evidence.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1024,
};

function responseCode(error: unknown): string | undefined {
  if (!(error instanceof BadRequestException)) return undefined;
  const response = error.getResponse();
  return typeof response === 'object' && response !== null
    ? String((response as Record<string, unknown>).code ?? '')
    : undefined;
}

async function captureRejectionCode(work: Promise<unknown>): Promise<string | undefined> {
  try {
    await work;
  } catch (error) {
    return responseCode(error);
  }
  throw new Error('Expected upload request to be rejected.');
}

describe('lab evidence upload abuse boundaries', () => {
  it('rejects an oversized file before any database or storage action', async () => {
    const rls = { withTrustedContext: jest.fn() };
    const adapter = { getPresignedUploadUrl: jest.fn() };
    const service = new LabEvidenceUploadService(rls as any, adapter as any);

    await expect(captureRejectionCode(service.requestForProvisioning({
      ...BASE_REQUEST,
      sizeBytes: 50 * 1024 * 1024 + 1,
    }, ADMIN))).resolves.toBe('SIZE_NOT_ALLOWED');
    expect(rls.withTrustedContext).not.toHaveBeenCalled();
    expect(adapter.getPresignedUploadUrl).not.toHaveBeenCalled();
  });

  it('rejects executable MIME types before creating a pending upload', async () => {
    const rls = { withTrustedContext: jest.fn() };
    const adapter = { getPresignedUploadUrl: jest.fn() };
    const service = new LabEvidenceUploadService(rls as any, adapter as any);

    await expect(captureRejectionCode(service.requestForProvisioning({
      ...BASE_REQUEST,
      mimeType: 'application/x-msdownload',
    }, ADMIN))).resolves.toBe('MIME_NOT_ALLOWED');
    expect(rls.withTrustedContext).not.toHaveBeenCalled();
    expect(adapter.getPresignedUploadUrl).not.toHaveBeenCalled();
  });

  it('strips path traversal from the object key and binds it to tenant plus Deal', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'document-security-upload' });
    const tx = {
      deal: {
        findUnique: jest.fn().mockResolvedValue({
          id: BASE_REQUEST.dealId,
          tenantId: ADMIN.tenantId,
        }),
      },
      organization: {
        findUnique: jest.fn().mockResolvedValue({
          id: BASE_REQUEST.laboratoryOrgId,
          tenantId: ADMIN.tenantId,
          status: 'VERIFIED',
          kycStatus: 'APPROVED',
        }),
      },
      dealDocument: { create },
    };
    const rls = {
      withTrustedContext: jest.fn(async (
        _user: RequestUser,
        work: (client: typeof tx, context: Record<string, string>) => Promise<unknown>,
      ) => work(tx, {
        userId: ADMIN.id,
        organizationId: ADMIN.orgId,
        tenantId: ADMIN.tenantId,
        role: ADMIN.role,
        sessionId: ADMIN.sessionId,
      })),
    };
    const adapter = {
      getPresignedUploadUrl: jest.fn().mockResolvedValue({
        url: 'https://storage.invalid/upload',
        expiresAt: '2026-07-15T03:00:00.000Z',
        requiredHeaders: { 'content-type': 'application/pdf' },
      }),
    };
    const service = new LabEvidenceUploadService(rls as any, adapter as any);

    const result = await service.requestForProvisioning({
      ...BASE_REQUEST,
      filename: '../../nested/evil.pdf',
    }, ADMIN);

    expect(result.objectKey).toMatch(/^tenant\/tenant-security\/deal\/deal-security-upload\/file_[^/]+\/evil\.pdf$/);
    expect(result.objectKey).not.toContain('..');
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: ADMIN.tenantId,
        dealId: BASE_REQUEST.dealId,
        name: 'evil.pdf',
        mimeType: 'application/pdf',
        s3Key: result.objectKey,
      }),
    });
  });
});
