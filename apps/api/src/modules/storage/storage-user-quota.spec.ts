import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { StorageService } from './storage.service';
import { Role, type RequestUser } from '../../common/types/request-user';

/**
 * ASVS 5.0 V5.2.4: a file size quota and a maximum number of files per user,
 * so one account cannot fill the storage.
 *
 * The per-file cap that existed bounds one upload and says nothing about a
 * thousand of them. What makes the bound real here is not the arithmetic but
 * the order: uploaded bytes never pass through this application, so the
 * presigned URL IS the write capability. Refusing after minting one would have
 * bounded the bookkeeping and left the storage open.
 */

const user: RequestUser = {
  id: 'user-1', email: 'u@example.test', role: Role.FARMER, orgId: 'org-1', tenantId: 'tenant-1',
} as RequestUser;

type Held = { files: number; bytes: number };

function service(held: Held) {
  const presign = jest.fn().mockResolvedValue({ url: 'https://storage.example.test/put', expiresAt: new Date().toISOString() });
  const created: unknown[] = [];
  const isolationLevels: unknown[] = [];

  const tx = {
    deal: { findUnique: jest.fn().mockResolvedValue({ id: 'deal-1', tenantId: 'tenant-1' }) },
    dealDocument: {
      aggregate: jest.fn().mockResolvedValue({ _count: { _all: held.files }, _sum: { sizeBytes: held.bytes } }),
      create: jest.fn().mockImplementation((args: unknown) => { created.push(args); return Promise.resolve({}); }),
    },
  };
  const rls = {
    withTrustedContext: jest.fn().mockImplementation(async (_u: unknown, work: Function, options?: { isolationLevel?: unknown }) => {
      isolationLevels.push(options?.isolationLevel);
      return work(tx, { userId: 'user-1', tenantId: 'tenant-1', orgId: 'org-1' });
    }),
  };

  const instance = new StorageService(
    rls as never,
    { getPresignedUploadUrl: presign } as never,
    {} as never,
  );
  return { instance, presign, created, tx, isolationLevels };
}

const request = { dealId: 'deal-1', filename: 'report.pdf', mimeType: 'application/pdf', sizeBytes: 1_000 };

describe('per-user storage quota', () => {
  it('lets an account within its allowance reserve an upload', async () => {
    const { instance, presign, created } = service({ files: 3, bytes: 5_000 });
    await expect(instance.requestUpload(request, user)).resolves.toHaveProperty('uploadUrl');
    expect(presign).toHaveBeenCalledTimes(1);
    expect(created).toHaveLength(1);
  });

  it('refuses when the account already holds the maximum number of files', async () => {
    const { instance } = service({ files: 500, bytes: 5_000 });
    await expect(instance.requestUpload(request, user)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses when this file would take the account past its byte allowance', async () => {
    const { instance } = service({ files: 1, bytes: 5 * 1024 * 1024 * 1024 });
    await expect(instance.requestUpload(request, user)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('mints no upload URL for a refused request, because the URL is the capability', async () => {
    // The whole control rests on this. A presigned URL handed out before the
    // check is a write that the check cannot take back.
    for (const held of [{ files: 500, bytes: 0 }, { files: 1, bytes: 5 * 1024 * 1024 * 1024 }]) {
      const { instance, presign, created } = service(held);
      await expect(instance.requestUpload(request, user)).rejects.toBeInstanceOf(BadRequestException);
      expect(presign).not.toHaveBeenCalled();
      expect(created).toHaveLength(0);
    }
  });

  it('counts the account, not the deal', async () => {
    const { instance, tx } = service({ files: 1, bytes: 10 });
    await instance.requestUpload(request, user);
    const where = (tx.dealDocument.aggregate as jest.Mock).mock.calls[0][0].where;
    expect(where.uploadedByUserId).toBe('user-1');
    expect(where.dealId).toBeUndefined();
  });

  it('ignores what occupies nothing, so abandoned attempts cannot lock the account out', async () => {
    const { instance, tx } = service({ files: 1, bytes: 10 });
    await instance.requestUpload(request, user);
    const where = (tx.dealDocument.aggregate as jest.Mock).mock.calls[0][0].where;
    expect(where.status).toEqual({ notIn: ['DELETED', 'UPLOAD_EXPIRED'] });
  });

  it('counts a live reservation, which is a URL somebody can still upload through', async () => {
    const { instance, tx } = service({ files: 1, bytes: 10 });
    await instance.requestUpload(request, user);
    const where = (tx.dealDocument.aggregate as jest.Mock).mock.calls[0][0].where;
    expect(where.status.notIn).not.toContain('UPLOAD_PENDING');
  });

  it('reads and writes in one serializable transaction, or the bound holds only when nobody is trying', async () => {
    // At read-committed two concurrent requests both read the same total and
    // both pass. The retry budget for a serialization failure comes with this
    // isolation level in RlsTransactionService.
    const { instance, isolationLevels } = service({ files: 1, bytes: 10 });
    await instance.requestUpload(request, user);
    expect(isolationLevels).toEqual([Prisma.TransactionIsolationLevel.Serializable]);
  });

  it('still refuses an oversized single file, which the per-file cap already did', async () => {
    const { instance } = service({ files: 0, bytes: 0 });
    await expect(
      instance.requestUpload({ ...request, sizeBytes: 200 * 1024 * 1024 + 1 }, user),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
