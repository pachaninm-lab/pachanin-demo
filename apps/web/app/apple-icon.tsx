import { readFile } from 'fs/promises';
import { join } from 'path';
import { ImageResponse } from 'next/og';
import { BRAND_MARK_BG } from '@/components/v7r/BrandMark';

export const size = {
  width: 180,
  height: 180,
};

export const contentType = 'image/png';

async function loadLogoSvg() {
  const candidates = [
    join(process.cwd(), 'public', 'brand', 'transparent-price-mark.svg'),
    join(process.cwd(), 'apps', 'web', 'public', 'brand', 'transparent-price-mark.svg'),
  ];

  for (const candidate of candidates) {
    try {
      return await readFile(candidate, 'utf8');
    } catch {}
  }

  throw new Error('Master logo asset not found');
}

export default async function AppleIcon() {
  const svg = await loadLogoSvg();
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: BRAND_MARK_BG,
        }}
      >
        <img
          src={src}
          alt=''
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          }}
        />
      </div>
    ),
    size,
  );
}
