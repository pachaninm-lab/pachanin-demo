import {
  type ObjectStorageAdapter,
  createObjectStorageAdapterFromEnv,
} from './object-storage.adapter';

const INTERNAL_MINIO_HOST = 'minio';
const INTERNAL_MINIO_PORT = '9000';

function isExplicitlyAllowedInternalMinio(endpoint: URL, env: NodeJS.ProcessEnv): boolean {
  return String(env.OBJECT_STORAGE_ALLOW_INSECURE_INTERNAL ?? '').toLowerCase() === 'true'
    && endpoint.protocol === 'http:'
    && endpoint.hostname === INTERNAL_MINIO_HOST
    && endpoint.port === INTERNAL_MINIO_PORT
    && endpoint.username === ''
    && endpoint.password === ''
    && endpoint.pathname === '/'
    && endpoint.search === ''
    && endpoint.hash === '';
}

export function createProductionObjectStorageAdapterFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): ObjectStorageAdapter {
  const production = String(env.NODE_ENV ?? '').toLowerCase() === 'production';
  const endpoint = String(env.OBJECT_STORAGE_ENDPOINT ?? '').trim();

  if (!production || !endpoint) {
    return createObjectStorageAdapterFromEnv(env);
  }

  const endpointUrl = new URL(endpoint);
  if (endpointUrl.protocol === 'https:') {
    return createObjectStorageAdapterFromEnv(env);
  }

  if (!isExplicitlyAllowedInternalMinio(endpointUrl, env)) {
    return createObjectStorageAdapterFromEnv(env);
  }

  return createObjectStorageAdapterFromEnv({
    ...env,
    NODE_ENV: 'internal-production-s3',
    OBJECT_STORAGE_DRIVER: 's3',
  });
}
