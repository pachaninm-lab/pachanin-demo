import { describe, expect, it } from 'vitest';
import {
  MAX_IMAGE_HEIGHT,
  MAX_IMAGE_PIXELS,
  MAX_IMAGE_WIDTH,
  MAX_REQUEST_IMAGE_PIXELS,
  assertImageWithinPixelBudget,
  createPixelBudget,
  isImageExtension,
  readImageGeometry,
} from '../../lib/uploads/image-dimensions';

/**
 * ASVS V5.2.6. The file-size limit bounds the input, not the decoder's output,
 * so a small file may declare an enormous image. Every fixture below is a few
 * dozen bytes; what varies is what the header claims.
 */

const be32 = (value: number) => {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(value >>> 0, 0);
  return b;
};

/** A PNG carrying only what a dimension read needs: signature, IHDR length, type, w, h. */
function png(width: number, height: number, frames?: number): Buffer {
  const parts = [
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    be32(13),
    Buffer.from('IHDR', 'latin1'),
    be32(width),
    be32(height),
    Buffer.alloc(5),
    be32(0),
  ];
  if (frames !== undefined) {
    parts.push(be32(8), Buffer.from('acTL', 'latin1'), be32(frames), be32(0), be32(0));
  }
  parts.push(be32(0), Buffer.from('IEND', 'latin1'));
  return Buffer.concat(parts);
}

/** A JPEG with SOI, one skipped APP0 segment, then SOF0 carrying height and width. */
function jpeg(width: number, height: number): Buffer {
  const app0 = Buffer.concat([Buffer.from([0xff, 0xe0]), Buffer.from([0x00, 0x04]), Buffer.alloc(2)]);
  const sof = Buffer.alloc(11);
  sof.writeUInt16BE(0xffc0, 0);
  sof.writeUInt16BE(9, 2);
  sof.writeUInt8(8, 4);
  sof.writeUInt16BE(height, 5);
  sof.writeUInt16BE(width, 7);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof]);
}

/** An ISO-BMFF fragment with one or more ispe boxes, which is where HEIC declares size. */
function heic(...sizes: Array<[number, number]>): Buffer {
  const head = Buffer.concat([be32(0x18), Buffer.from('ftypheic', 'latin1')]);
  const boxes = sizes.map(([w, h]) =>
    Buffer.concat([be32(20), Buffer.from('ispe', 'latin1'), be32(0), be32(w), be32(h)]),
  );
  return Buffer.concat([head, ...boxes]);
}

const budget = () => createPixelBudget();

describe('readImageGeometry', () => {
  it('reads PNG dimensions from IHDR', () => {
    expect(readImageGeometry('png', png(1024, 768))).toEqual({ width: 1024, height: 768, frames: 1 });
  });

  it('reads the APNG frame count, so a multi-frame file cannot pass one frame at a time', () => {
    expect(readImageGeometry('png', png(100, 100, 900))).toEqual({ width: 100, height: 100, frames: 900 });
  });

  it('reads JPEG dimensions from SOF, skipping earlier segments', () => {
    expect(readImageGeometry('jpeg', jpeg(4032, 3024))).toEqual({ width: 4032, height: 3024, frames: 1 });
  });

  it('takes the largest ispe and counts them, because a HEIC may hold several images', () => {
    expect(readImageGeometry('isobmff', heic([800, 600], [4000, 3000]))).toEqual({
      width: 4000, height: 3000, frames: 2,
    });
  });

  it('returns null rather than guessing on a malformed or truncated header', () => {
    expect(readImageGeometry('png', Buffer.alloc(0))).toBeNull();
    expect(readImageGeometry('png', png(10, 10).subarray(0, 20))).toBeNull();
    expect(readImageGeometry('png', Buffer.concat([Buffer.alloc(12), Buffer.from('IDAT', 'latin1')]))).toBeNull();
    expect(readImageGeometry('jpeg', Buffer.from([0xff, 0xd8]))).toBeNull();
    expect(readImageGeometry('jpeg', jpeg(10, 10).subarray(0, 8))).toBeNull();
    expect(readImageGeometry('isobmff', heic())).toBeNull();
  });

  it('does not walk a JPEG past the start of scan looking for dimensions', () => {
    const sos = Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.from([0xff, 0xda]), Buffer.from([0x00, 0x02])]);
    expect(readImageGeometry('jpeg', sos)).toBeNull();
  });
});

describe('assertImageWithinPixelBudget', () => {
  it('accepts ordinary document images', () => {
    // A4 at 300 dpi, a phone photo, and the same photo as HEIC.
    expect(() => assertImageWithinPixelBudget('png', png(2480, 3508), budget())).not.toThrow();
    expect(() => assertImageWithinPixelBudget('jpg', jpeg(4032, 3024), budget())).not.toThrow();
    expect(() => assertImageWithinPixelBudget('jpeg', jpeg(4032, 3024), budget())).not.toThrow();
    expect(() => assertImageWithinPixelBudget('heic', heic([4032, 3024]), budget())).not.toThrow();
  });

  // The whole point: a few dozen bytes claiming an image nobody can decode safely.
  it('rejects a tiny file that declares an enormous image', () => {
    const bomb = png(65_535, 65_535);
    expect(bomb.length).toBeLessThan(80);
    expect(() => assertImageWithinPixelBudget('png', bomb, budget())).toThrow('IMAGE_WIDTH_EXCEEDED:png');
  });

  it('rejects width over the limit and accepts exactly the limit', () => {
    expect(() => assertImageWithinPixelBudget('png', png(MAX_IMAGE_WIDTH + 1, 10), budget()))
      .toThrow('IMAGE_WIDTH_EXCEEDED:png');
    expect(() => assertImageWithinPixelBudget('png', png(MAX_IMAGE_WIDTH, 10), budget())).not.toThrow();
  });

  it('rejects height over the limit and accepts exactly the limit', () => {
    expect(() => assertImageWithinPixelBudget('png', png(10, MAX_IMAGE_HEIGHT + 1), budget()))
      .toThrow('IMAGE_HEIGHT_EXCEEDED:png');
    expect(() => assertImageWithinPixelBudget('png', png(10, MAX_IMAGE_HEIGHT), budget())).not.toThrow();
  });

  it('rejects a pixel count over the limit even when each side is within its own limit', () => {
    // 20000 x 19999 is under both side limits and far over the area limit.
    expect(() => assertImageWithinPixelBudget('png', png(MAX_IMAGE_WIDTH, MAX_IMAGE_HEIGHT - 1), budget()))
      .toThrow('IMAGE_PIXELS_EXCEEDED:png');
  });

  it('accepts the exact area boundary and rejects one pixel more', () => {
    const side = 5_000;
    const height = MAX_IMAGE_PIXELS / side;
    expect(Number.isInteger(height)).toBe(true);
    expect(() => assertImageWithinPixelBudget('png', png(side, height), budget())).not.toThrow();
    expect(() => assertImageWithinPixelBudget('png', png(side, height + 1), budget()))
      .toThrow('IMAGE_PIXELS_EXCEEDED:png');
  });

  describe('overflow and invalid dimensions', () => {
    it('rejects the 32-bit boundary values a header can declare', () => {
      // 0xFFFFFFFF in both fields: the product would overflow a naive 32-bit
      // multiply, so the side limits are checked before anything is multiplied.
      expect(() => assertImageWithinPixelBudget('png', png(0xffffffff, 0xffffffff), budget()))
        .toThrow('IMAGE_WIDTH_EXCEEDED:png');
      expect(() => assertImageWithinPixelBudget('png', png(0x10000, 0x10000), budget()))
        .toThrow('IMAGE_WIDTH_EXCEEDED:png');
    });

    it('rejects zero dimensions', () => {
      expect(() => assertImageWithinPixelBudget('png', png(0, 100), budget()))
        .toThrow('IMAGE_DIMENSIONS_INVALID:png');
      expect(() => assertImageWithinPixelBudget('png', png(100, 0), budget()))
        .toThrow('IMAGE_DIMENSIONS_INVALID:png');
    });

    it('treats an unreadable header as a refusal, not as permission', () => {
      expect(() => assertImageWithinPixelBudget('png', Buffer.alloc(4), budget()))
        .toThrow('IMAGE_HEADER_UNREADABLE:png');
      expect(() => assertImageWithinPixelBudget('jpeg', Buffer.from([0xff, 0xd8]), budget()))
        .toThrow('IMAGE_HEADER_UNREADABLE:jpeg');
      expect(() => assertImageWithinPixelBudget('heic', heic(), budget()))
        .toThrow('IMAGE_HEADER_UNREADABLE:heic');
    });
  });

  describe('multi-frame and cumulative budget', () => {
    it('counts APNG frames, so frames cannot smuggle the area past the limit', () => {
      const single = png(4_000, 4_000);
      expect(() => assertImageWithinPixelBudget('png', single, budget())).not.toThrow();
      const many = png(4_000, 4_000, 10);
      expect(() => assertImageWithinPixelBudget('png', many, budget()))
        .toThrow('IMAGE_PIXELS_EXCEEDED:png');
    });

    it('counts several HEIC images rather than only the largest', () => {
      const one = heic([4_000, 4_000]);
      expect(() => assertImageWithinPixelBudget('heic', one, budget())).not.toThrow();
      const eight = heic(...Array.from({ length: 8 }, () => [4_000, 4_000] as [number, number]));
      expect(() => assertImageWithinPixelBudget('heic', eight, budget()))
        .toThrow('IMAGE_PIXELS_EXCEEDED:heic');
    });

    it('exhausts a shared budget across files that are each individually fine', () => {
      const shared = budget();
      const image = png(5_000, 5_000); // 25 Mpx, under the per-image limit
      expect(() => assertImageWithinPixelBudget('png', image, shared)).not.toThrow();
      expect(() => assertImageWithinPixelBudget('png', image, shared)).not.toThrow();
      expect(shared.remaining).toBe(MAX_REQUEST_IMAGE_PIXELS - 50_000_000);
      expect(() => assertImageWithinPixelBudget('png', image, shared))
        .toThrow('IMAGE_REQUEST_PIXEL_BUDGET_EXCEEDED:png');
    });

    it('does not spend budget on a rejected file', () => {
      const shared = budget();
      expect(() => assertImageWithinPixelBudget('png', png(MAX_IMAGE_WIDTH + 1, 10), shared)).toThrow();
      expect(shared.remaining).toBe(MAX_REQUEST_IMAGE_PIXELS);
    });
  });

  it('leaves non-image extensions alone, since they have no geometry to bound', () => {
    for (const ext of ['pdf', 'docx', 'xlsx', 'txt', 'csv']) {
      expect(isImageExtension(ext)).toBe(false);
      expect(() => assertImageWithinPixelBudget(ext, Buffer.from('anything'), budget())).not.toThrow();
    }
  });

  it('recognises exactly the image extensions the route accepts', () => {
    for (const ext of ['png', 'jpg', 'jpeg', 'heic']) expect(isImageExtension(ext)).toBe(true);
    // Not accepted by the route, so not claimed to be bounded here.
    for (const ext of ['webp', 'gif', 'bmp', 'tiff']) expect(isImageExtension(ext)).toBe(false);
  });
});
