import { S3CompatibleStorageAdapter } from './object-storage.adapter';
import { createProductionObjectStorageAdapterFromEnv } from './production-object-storage.factory';

const baseEnv: NodeJS.ProcessEnv = {
  NODE_ENV: 'production',
  OBJECT_STORAGE_DRIVER: 's3',
  OBJECT_STORAGE_REGION: 'ru-1',
  OBJECT_STORAGE_BUCKET: 'grainflow-documents',
  OBJECT_STORAGE_ACCESS_KEY_ID: 'access',
  OBJECT_STORAGE_SECRET_ACCESS_KEY: 'secret',
};

describe('production object storage factory', () => {
  it('allows only explicitly gated internal MinIO over HTTP', () => {
    const adapter = createProductionObjectStorageAdapterFromEnv({
      ...baseEnv,
      OBJECT_STORAGE_ENDPOINT: 'http://minio:9000',
      OBJECT_STORAGE_ALLOW_INSECURE_INTERNAL: 'true',
    });

    expect(adapter).toBeInstanceOf(S3CompatibleStorageAdapter);
  });

  it('rejects internal MinIO HTTP without the explicit flag', () => {
    expect(() => createProductionObjectStorageAdapterFromEnv({
      ...baseEnv,
      OBJECT_STORAGE_ENDPOINT: 'http://minio:9000',
    })).toThrow(/requires HTTPS/i);
  });

  it.each([
    'http://objects.example.test:9000',
    'http://minio:9001',
    'http://minio:9000/path',
    'http://user:pass@minio:9000',
  ])('rejects non-canonical HTTP endpoint %s even when the flag is set', (endpoint) => {
    expect(() => createProductionObjectStorageAdapterFromEnv({
      ...baseEnv,
      OBJECT_STORAGE_ENDPOINT: endpoint,
      OBJECT_STORAGE_ALLOW_INSECURE_INTERNAL: 'true',
    })).toThrow(/requires HTTPS/i);
  });

  it('keeps normal HTTPS production storage unchanged', () => {
    const adapter = createProductionObjectStorageAdapterFromEnv({
      ...baseEnv,
      OBJECT_STORAGE_ENDPOINT: 'https://objects.example.test',
    });

    expect(adapter).toBeInstanceOf(S3CompatibleStorageAdapter);
  });
});
