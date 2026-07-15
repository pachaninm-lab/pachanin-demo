import { createHash } from 'node:crypto';
import { BRAND_LOGO_PNG_BASE64, BRAND_LOGO_PNG_SHA256 } from '@/components/v7r/canonical-logo-png';

export const runtime = 'nodejs';
export const dynamic = 'force-static';

const logoBytes = Buffer.from(BRAND_LOGO_PNG_BASE64, 'base64');
const logoHash = createHash('sha256').update(logoBytes).digest('hex');
const pngSignature = logoBytes.subarray(0, 8).toString('hex');
const width = logoBytes.readUInt32BE(16);
const height = logoBytes.readUInt32BE(20);

if (
  logoHash !== BRAND_LOGO_PNG_SHA256 ||
  pngSignature !== '89504e470d0a1a0a' ||
  width !== 128 ||
  height !== 128
) {
  throw new Error('Canonical brand logo integrity check failed.');
}

export function GET() {
  return new Response(new Uint8Array(logoBytes), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': String(logoBytes.byteLength),
      'Cache-Control': 'public, max-age=31536000, immutable',
      ETag: `"${BRAND_LOGO_PNG_SHA256}"`,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
