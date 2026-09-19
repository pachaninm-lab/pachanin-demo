import { promises as fs } from 'fs';
import { randomUUID } from 'crypto';
import {
  LocalFilesystemStorageAdapter,
  S3CompatibleStorageAdapter,
  createObjectStorageAdapterFromEnv,
} from './object-storage.adapter';

describe('object storage adapters', () => {
  it('fails closed when filesystem storage is requested in production', () => {
    expect(() => createObjectStorageAdapterFromEnv({
      NODE_ENV: 'production',
      OBJECT_STORAGE_DRIVER: 'filesystem',
    })).toThrow(/forbidden in production/i);
  });

  it('creates bounded S3-compatible SigV4 URLs without leaking the secret', async () => {
    const adapter = new S3CompatibleStorageAdapter({
      endpoint: 'https://objects.example.test',
      region: 'ru-1',
      bucket: 'evidence',
      accessKeyId: 'ACCESS123',
      secretAccessKey: 'DO_NOT_LEAK',
      forcePathStyle: true,
    });
    const result = await adapter.getPresignedUploadUrl('tenant/a/deal/b/file.pdf', 'application/pdf', 300);
    const url = new URL(result.url);
    expect(url.protocol).toBe('https:');
    expect(url.pathname).toBe('/evidence/tenant/a/deal/b/file.pdf');
    expect(url.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[a-f0-9]{64}$/);
    expect(result.url).not.toContain('DO_NOT_LEAK');
  });

  it('streams and hashes a filesystem object without process-local state', async () => {
    const root = `/tmp/storage-adapter-unit-${randomUUID()}`;
    const first = new LocalFilesystemStorageAdapter(root);
    const second = new LocalFilesystemStorageAdapter(root);
    try {
      await first.putObjectForTest('tenant/t/deal/d/file.txt', 'evidence', 'text/plain');
      await expect(second.inspectAndHashObject('tenant/t/deal/d/file.txt', 1024)).resolves.toMatchObject({
        sizeBytes: 8,
        contentType: 'text/plain',
        sha256: 'ee8250fb76e094b34b471f13a73dbbe51d1ae142e9df59d7c0d31ec20f0a0a8e',
      });
      await expect(second.inspectAndHashObject('tenant/t/deal/d/file.txt', 4)).rejects.toThrow(/exceeds/i);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
