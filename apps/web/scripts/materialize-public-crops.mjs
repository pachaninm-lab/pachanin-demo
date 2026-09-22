import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Build-time data preparation only. No browser CDN, production credentials,
// application data, new dependencies or generated/expanded picture content.
const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(new URL('../package.json', import.meta.url));
const nextRequire = createRequire(require.resolve('next/package.json'));
const sharp = nextRequire('sharp');
const contract = JSON.parse(await readFile(new URL('./public-crop-photos.json', import.meta.url), 'utf8'));
const crops = ['wheat', 'barley', 'corn', 'sunflower', 'soybean', 'rapeseed', 'rye', 'oats'];
const sizes = [320, 640, 960];
const output = join(root, 'public/platform-v7/crops');
const cache = join(root, '.next/cache/public-crop-originals');
const limit = 20 * 1024 * 1024;
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
if (contract.schemaVersion !== 'pc-crop.public-photographs.v1' || contract.license !== 'CC0-1.0'
  || !Array.isArray(contract.photos) || contract.photos.length !== crops.length
  || new Set(contract.photos.map((photo) => photo.crop)).size !== crops.length
  || contract.photos.some((photo) => !crops.includes(photo.crop))) {
  throw new Error('Invalid public crop photograph contract.');
}
await mkdir(output, { recursive: true });
await mkdir(cache, { recursive: true });

async function fetchOriginal(photo) {
  const url = new URL(photo.original);
  if (url.protocol !== 'https:' || url.hostname !== 'upload.wikimedia.org' || url.port
    || url.username || url.password || url.search || url.hash
    || !url.pathname.startsWith('/wikipedia/commons/') || !url.pathname.endsWith('.jpg')) {
    throw new Error(`Crop ${photo.crop}: original must be a fixed Wikimedia JPEG URL.`);
  }
  const cachedPath = join(cache, `${photo.crop}.jpg`);
  try {
    const bytes = await readFile(cachedPath);
    if (bytes.byteLength <= limit && photo.sha256 && hash(bytes) === photo.sha256) return bytes;
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const response = await fetch(url, {
    method: 'GET', redirect: 'error', credentials: 'omit',
    headers: { Accept: 'image/jpeg', 'User-Agent': 'PC-CROP-public-image-build/1.0 (https://github.com/pachaninm-lab/pachanin-demo)' },
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok || !/^image\/jpeg(?:;|$)/i.test(response.headers.get('content-type') || '')) {
    throw new Error(`Crop ${photo.crop}: image download failed (${response.status}).`);
  }
  if (!response.body || Number(response.headers.get('content-length') || 0) > limit) {
    await response.body?.cancel();
    throw new Error(`Crop ${photo.crop}: image body is absent or exceeds the limit.`);
  }
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw new Error(`Crop ${photo.crop}: streamed image exceeds the limit.`);
      }
      chunks.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  const bytes = Buffer.concat(chunks);
  if (bytes.length < 3 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    throw new Error(`Crop ${photo.crop}: expected JPEG bytes.`);
  }
  await writeFile(cachedPath, bytes);
  return bytes;
}

const evidence = new Array(crops.length);
const failures = [];
let cursor = 0;
async function worker() {
  while (cursor < contract.photos.length) {
    const index = cursor++;
    const photo = contract.photos[index];
    try {
      const bytes = await fetchOriginal(photo);
      const sha256 = hash(bytes);
      const decoder = sharp(bytes, { limitInputPixels: 40_000_000, failOn: 'error' });
      const meta = await decoder.metadata();
      if (meta.format !== 'jpeg' || !meta.width || !meta.height || meta.width < 960 || meta.height < 600 || (meta.pages ?? 1) !== 1) {
        throw new Error(`Crop ${photo.crop}: invalid image dimensions or format.`);
      }
      console.log(`PUBLIC_CROP_SOURCE=${JSON.stringify({ crop:photo.crop, sha256, bytes:bytes.length, width:meta.width, height:meta.height })}`);
      // A preparation checkout may discover digests, but it may not publish a
      // build until all eight exact originals are pinned in the reviewed contract.
      if (!/^[a-f0-9]{64}$/.test(photo.sha256 ?? '') || photo.sha256 !== sha256) {
        failures.push(`${photo.crop}: source digest requires exact contract admission`);
        continue;
      }
      const variants = [];
      for (const width of sizes) {
        const height = width * 5 / 8;
        const image = await sharp(bytes, { limitInputPixels: 40_000_000, failOn: 'error' })
          .rotate().resize(width, height, { fit:'cover', position:'centre' })
          .toColourspace('srgb').webp({ quality:78, effort:5 }).toBuffer();
        const name = `${photo.crop}-${width}.webp`;
        await writeFile(join(output, name), image);
        variants.push({ file:name, width, height, bytes:image.length, sha256:hash(image) });
      }
      evidence[index] = { crop:photo.crop, page:photo.page, credit:photo.credit, originalSha256:sha256, variants };
    } catch (error) {
      failures.push(`${photo.crop}: ${error instanceof Error ? error.message : 'image preparation failed'}`);
    }
  }
}
await Promise.all([worker(), worker()]);
if (failures.length) {
  for (const reason of failures) console.error(`PUBLIC_CROP_FAILURE=${reason}`);
  throw new Error('Public crop photographs are not fully verified. No fallback artwork or incomplete image set is accepted.');
}
await writeFile(join(output, 'manifest.json'), JSON.stringify({ schemaVersion:contract.schemaVersion, license:contract.license, licenseUrl:contract.licenseUrl, use:contract.use, photos:evidence }, null, 2) + '\n');
console.log('PUBLIC_CROP_PHOTOGRAPHS=8');
console.log('PUBLIC_CROP_LOCAL_WEBP_VARIANTS=24');
console.log('PUBLIC_CROP_ORIGINAL_HASHES=VERIFIED');
console.log('PUBLIC_CROP_BROWSER_EXTERNAL_IMAGE_REQUESTS=NONE');
