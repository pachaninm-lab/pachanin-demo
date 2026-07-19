import { createHash, createHmac } from 'crypto';
import { createReadStream, promises as fs } from 'fs';
import { dirname, resolve, sep } from 'path';

export const OBJECT_STORAGE_ADAPTER = 'OBJECT_STORAGE_ADAPTER';

export type PresignedObjectUrl = {
  url: string;
  expiresAt: string;
  requiredHeaders?: Record<string, string>;
};

export type ObjectInspection = {
  sizeBytes: number;
  contentType: string;
  sha256: string;
  eTag?: string;
};

export interface ObjectStorageAdapter {
  readonly driver: 's3' | 'filesystem';
  getPresignedUploadUrl(key: string, mimeType: string, ttlSeconds: number): Promise<PresignedObjectUrl>;
  getPresignedDownloadUrl(key: string, ttlSeconds: number): Promise<PresignedObjectUrl>;
  inspectAndHashObject(key: string, maxBytes: number): Promise<ObjectInspection>;
  deleteObject(key: string): Promise<void>;
}

const EMPTY_SHA256 = createHash('sha256').update('').digest('hex');

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac('sha256', key).update(value).digest();
}

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function canonicalPath(pathname: string): string {
  return pathname
    .split('/')
    .map((segment) => encodeRfc3986(decodeURIComponent(segment)))
    .join('/')
    .replace(/%2F/gi, '/');
}

function amzTimestamp(date: Date): { date: string; datetime: string } {
  const datetime = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return { date: datetime.slice(0, 8), datetime };
}

function signingKey(secret: string, date: string, region: string): Buffer {
  const dateKey = hmac(`AWS4${secret}`, date);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, 's3');
  return hmac(serviceKey, 'aws4_request');
}

export type S3CompatibleStorageConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  forcePathStyle?: boolean;
};

export class S3CompatibleStorageAdapter implements ObjectStorageAdapter {
  readonly driver = 's3' as const;
  private readonly endpoint: URL;

  constructor(private readonly config: S3CompatibleStorageConfig) {
    this.endpoint = new URL(config.endpoint);
    if (!['https:', 'http:'].includes(this.endpoint.protocol)) {
      throw new Error('OBJECT_STORAGE_ENDPOINT must use http or https.');
    }
    if (!config.region || !config.bucket || !config.accessKeyId || !config.secretAccessKey) {
      throw new Error('S3-compatible object storage configuration is incomplete.');
    }
  }

  async getPresignedUploadUrl(key: string, mimeType: string, ttlSeconds: number): Promise<PresignedObjectUrl> {
    const now = new Date();
    return {
      url: this.presign('PUT', key, ttlSeconds, now),
      expiresAt: new Date(now.getTime() + ttlSeconds * 1000).toISOString(),
      requiredHeaders: { 'content-type': mimeType },
    };
  }

  async getPresignedDownloadUrl(key: string, ttlSeconds: number): Promise<PresignedObjectUrl> {
    const now = new Date();
    return {
      url: this.presign('GET', key, ttlSeconds, now),
      expiresAt: new Date(now.getTime() + ttlSeconds * 1000).toISOString(),
    };
  }

  async inspectAndHashObject(key: string, maxBytes: number): Promise<ObjectInspection> {
    const target = this.objectUrl(key);
    const headers = this.authorizationHeaders('GET', target, new Date());
    const response = await fetch(target, {
      method: 'GET',
      headers,
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok || !response.body) {
      throw new Error(`Object storage GET failed with ${response.status}.`);
    }

    const hash = createHash('sha256');
    let sizeBytes = 0;
    const reader = response.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        sizeBytes += value.byteLength;
        if (sizeBytes > maxBytes) {
          throw new Error('Object exceeds the permitted verification boundary.');
        }
        hash.update(value);
      }
    } finally {
      reader.releaseLock();
    }

    return {
      sizeBytes,
      contentType: normalizeMimeType(response.headers.get('content-type') ?? 'application/octet-stream'),
      sha256: hash.digest('hex'),
      eTag: response.headers.get('etag') ?? undefined,
    };
  }

  async deleteObject(key: string): Promise<void> {
    const target = this.objectUrl(key);
    const headers = this.authorizationHeaders('DELETE', target, new Date());
    const response = await fetch(target, {
      method: 'DELETE',
      headers,
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`Object storage DELETE failed with ${response.status}.`);
    }
  }

  private objectUrl(key: string): URL {
    const normalizedKey = key.split('/').map(encodeRfc3986).join('/');
    const url = new URL(this.endpoint.toString());
    const basePath = url.pathname.replace(/\/$/, '');
    if (this.config.forcePathStyle !== false) {
      url.pathname = `${basePath}/${encodeRfc3986(this.config.bucket)}/${normalizedKey}`;
    } else {
      url.hostname = `${this.config.bucket}.${url.hostname}`;
      url.pathname = `${basePath}/${normalizedKey}`;
    }
    url.search = '';
    return url;
  }

  private presign(method: 'PUT' | 'GET', key: string, ttlSeconds: number, now: Date): string {
    const target = this.objectUrl(key);
    const timestamp = amzTimestamp(now);
    const scope = `${timestamp.date}/${this.config.region}/s3/aws4_request`;
    const params: Array<[string, string]> = [
      ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
      ['X-Amz-Credential', `${this.config.accessKeyId}/${scope}`],
      ['X-Amz-Date', timestamp.datetime],
      ['X-Amz-Expires', String(ttlSeconds)],
      ['X-Amz-SignedHeaders', 'host'],
    ];
    if (this.config.sessionToken) params.push(['X-Amz-Security-Token', this.config.sessionToken]);
    const canonicalQuery = params
      .map(([name, value]) => [encodeRfc3986(name), encodeRfc3986(value)] as const)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, value]) => `${name}=${value}`)
      .join('&');
    const canonicalRequest = [
      method,
      canonicalPath(target.pathname),
      canonicalQuery,
      `host:${target.host}\n`,
      'host',
      'UNSIGNED-PAYLOAD',
    ].join('\n');
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      timestamp.datetime,
      scope,
      sha256(canonicalRequest),
    ].join('\n');
    const signature = createHmac('sha256', signingKey(this.config.secretAccessKey, timestamp.date, this.config.region))
      .update(stringToSign)
      .digest('hex');
    target.search = `${canonicalQuery}&X-Amz-Signature=${signature}`;
    return target.toString();
  }

  private authorizationHeaders(method: 'GET' | 'DELETE', target: URL, now: Date): Record<string, string> {
    const timestamp = amzTimestamp(now);
    const scope = `${timestamp.date}/${this.config.region}/s3/aws4_request`;
    const headers: Record<string, string> = {
      'x-amz-content-sha256': EMPTY_SHA256,
      'x-amz-date': timestamp.datetime,
    };
    if (this.config.sessionToken) headers['x-amz-security-token'] = this.config.sessionToken;
    const signedHeaders = ['host', ...Object.keys(headers).sort()];
    const canonicalHeaders = [
      `host:${target.host}`,
      ...Object.keys(headers).sort().map((name) => `${name}:${headers[name].trim()}`),
      '',
    ].join('\n');
    const canonicalRequest = [
      method,
      canonicalPath(target.pathname),
      '',
      canonicalHeaders,
      signedHeaders.join(';'),
      EMPTY_SHA256,
    ].join('\n');
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      timestamp.datetime,
      scope,
      sha256(canonicalRequest),
    ].join('\n');
    const signature = createHmac('sha256', signingKey(this.config.secretAccessKey, timestamp.date, this.config.region))
      .update(stringToSign)
      .digest('hex');
    headers.Authorization = `AWS4-HMAC-SHA256 Credential=${this.config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders.join(';')}, Signature=${signature}`;
    return headers;
  }
}

export class LocalFilesystemStorageAdapter implements ObjectStorageAdapter {
  readonly driver = 'filesystem' as const;
  private readonly root: string;

  constructor(rootDirectory: string) {
    this.root = resolve(rootDirectory);
  }

  async getPresignedUploadUrl(key: string, _mimeType: string, ttlSeconds: number): Promise<PresignedObjectUrl> {
    return {
      url: `local-object://${encodeURIComponent(key)}`,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    };
  }

  async getPresignedDownloadUrl(key: string, ttlSeconds: number): Promise<PresignedObjectUrl> {
    return {
      url: `local-object://${encodeURIComponent(key)}`,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    };
  }

  async inspectAndHashObject(key: string, maxBytes: number): Promise<ObjectInspection> {
    const path = this.objectPath(key);
    const metadata = await this.readMetadata(key);
    const hash = createHash('sha256');
    let sizeBytes = 0;
    const stream = createReadStream(path);
    for await (const chunk of stream) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      sizeBytes += buffer.length;
      if (sizeBytes > maxBytes) {
        stream.destroy();
        throw new Error('Object exceeds the permitted verification boundary.');
      }
      hash.update(buffer);
    }
    return {
      sizeBytes,
      contentType: normalizeMimeType(metadata.mimeType),
      sha256: hash.digest('hex'),
      eTag: metadata.eTag,
    };
  }

  async deleteObject(key: string): Promise<void> {
    await Promise.allSettled([
      fs.unlink(this.objectPath(key)),
      fs.unlink(this.metadataPath(key)),
    ]);
  }

  async putObjectForTest(key: string, content: Buffer | string, mimeType: string): Promise<void> {
    const objectPath = this.objectPath(key);
    await fs.mkdir(dirname(objectPath), { recursive: true });
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
    await fs.writeFile(objectPath, buffer, { flag: 'wx' });
    await fs.writeFile(
      this.metadataPath(key),
      JSON.stringify({ mimeType: normalizeMimeType(mimeType), eTag: sha256(buffer) }),
      { flag: 'wx' },
    );
  }

  private objectPath(key: string): string {
    const path = resolve(this.root, key);
    if (path !== this.root && !path.startsWith(`${this.root}${sep}`)) {
      throw new Error('Object key escapes the configured storage root.');
    }
    return path;
  }

  private metadataPath(key: string): string {
    return `${this.objectPath(key)}.meta.json`;
  }

  private async readMetadata(key: string): Promise<{ mimeType: string; eTag?: string }> {
    const raw = await fs.readFile(this.metadataPath(key), 'utf8');
    const parsed = JSON.parse(raw) as { mimeType?: unknown; eTag?: unknown };
    return {
      mimeType: typeof parsed.mimeType === 'string' ? parsed.mimeType : 'application/octet-stream',
      eTag: typeof parsed.eTag === 'string' ? parsed.eTag : undefined,
    };
  }
}

export function normalizeMimeType(value: string): string {
  return value.split(';', 1)[0].trim().toLowerCase();
}

export function createObjectStorageAdapterFromEnv(env: NodeJS.ProcessEnv = process.env): ObjectStorageAdapter {
  const production = String(env.NODE_ENV ?? '').toLowerCase() === 'production';
  const driver = String(env.OBJECT_STORAGE_DRIVER ?? (production ? 's3' : 'filesystem')).toLowerCase();
  if (driver === 'filesystem') {
    if (production) throw new Error('Filesystem object storage is forbidden in production.');
    return new LocalFilesystemStorageAdapter(
      env.OBJECT_STORAGE_LOCAL_ROOT || `/tmp/transparent-price-object-storage-${process.pid}`,
    );
  }
  if (driver !== 's3') throw new Error(`Unsupported OBJECT_STORAGE_DRIVER: ${driver}`);

  const endpoint = String(env.OBJECT_STORAGE_ENDPOINT ?? '').trim();
  if (!endpoint) throw new Error('OBJECT_STORAGE_ENDPOINT is required for the s3 driver.');
  const endpointUrl = new URL(endpoint);
  // HTTPS is mandatory for any endpoint reachable over an untrusted network.
  // A private, in-network endpoint (e.g. an in-cluster MinIO on the container
  // network, never exposed publicly) may opt out explicitly.
  const allowInsecureEndpoint =
    String(env.OBJECT_STORAGE_ALLOW_INSECURE_ENDPOINT ?? '').toLowerCase() === 'true';
  if (production && endpointUrl.protocol !== 'https:' && !allowInsecureEndpoint) {
    throw new Error(
      'Production object storage requires HTTPS. Set OBJECT_STORAGE_ALLOW_INSECURE_ENDPOINT=true only for a trusted private-network endpoint.',
    );
  }
  return new S3CompatibleStorageAdapter({
    endpoint,
    region: String(env.OBJECT_STORAGE_REGION ?? '').trim(),
    bucket: String(env.OBJECT_STORAGE_BUCKET ?? '').trim(),
    accessKeyId: String(env.OBJECT_STORAGE_ACCESS_KEY_ID ?? '').trim(),
    secretAccessKey: String(env.OBJECT_STORAGE_SECRET_ACCESS_KEY ?? '').trim(),
    sessionToken: env.OBJECT_STORAGE_SESSION_TOKEN?.trim() || undefined,
    forcePathStyle: String(env.OBJECT_STORAGE_FORCE_PATH_STYLE ?? 'true').toLowerCase() !== 'false',
  });
}
