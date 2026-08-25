import { describe, expect, it } from 'vitest';
import {
  MEDIA_TYPES,
  TEXT_EXTENSIONS,
  assertContentMatchesExtension,
  detectContent,
} from '../../lib/uploads/content-signature';

/**
 * ASVS V5.2.2 (L1): расширение имени выбирает обработчик, а имя задаёт
 * отправитель. До этой проверки байты уходили в zipEntry, extractPdf, ExcelJS и
 * во внешний OCR на основании недоверенной строки.
 */

const bytes = (...values: number[]) => Buffer.from(values);

const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0);
const PDF = Buffer.from('%PDF-1.7\nrest of the document', 'latin1');
const ZIP = bytes(0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0);
const OLE2 = bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
const TEXT = Buffer.from('Договор поставки зерна №17\nЦена: 14 500 ₽/т', 'utf8');

/** ISO-BMFF: четыре байта длины бокса, затем 'ftyp', затем бренд. */
const isoBmff = (brand: string) =>
  Buffer.concat([bytes(0, 0, 0, 0x18), Buffer.from('ftyp', 'latin1'), Buffer.from(brand, 'latin1')]);

describe('detectContent', () => {
  it.each([
    ['png', PNG, 'png'],
    ['jpeg', JPEG, 'jpeg'],
    ['pdf', PDF, 'pdf'],
    ['zip', ZIP, 'zip'],
    ['ole2', OLE2, 'ole2'],
    ['isobmff', isoBmff('heic'), 'isobmff'],
  ])('recognises %s', (_label, buffer, expected) => {
    expect(detectContent(buffer)).toBe(expected);
  });

  it('recognises the empty and spanned ZIP markers, not only the local header', () => {
    expect(detectContent(bytes(0x50, 0x4b, 0x05, 0x06, 0, 0, 0, 0))).toBe('zip');
    expect(detectContent(bytes(0x50, 0x4b, 0x07, 0x08, 0, 0, 0, 0))).toBe('zip');
  });

  it('returns null for plain text, which has no signature to find', () => {
    expect(detectContent(TEXT)).toBeNull();
  });

  it('does not read past the end of a short buffer', () => {
    expect(detectContent(Buffer.alloc(0))).toBeNull();
    expect(detectContent(bytes(0x89, 0x50))).toBeNull();
    expect(detectContent(bytes(0x50, 0x4b))).toBeNull();
  });
});

describe('assertContentMatchesExtension', () => {
  describe('accepts content that matches the claimed extension', () => {
    it.each([
      ['png', PNG],
      ['jpg', JPEG],
      ['jpeg', JPEG],
      ['pdf', PDF],
      ['docx', ZIP],
      ['xlsx', ZIP],
      ['heic', isoBmff('heic')],
    ])('%s', (ext, buffer) => {
      expect(() => assertContentMatchesExtension(ext, buffer)).not.toThrow();
    });
  });

  describe('rejects content that does not match the claimed extension', () => {
    // The shape that mattered: a name the sender controls choosing the parser.
    it.each([
      ['png', PDF],
      ['png', ZIP],
      ['jpg', PNG],
      ['pdf', ZIP],
      ['pdf', PNG],
      ['docx', PDF],
      ['xlsx', PNG],
      ['heic', PNG],
    ])('%s carrying the wrong content', (ext, buffer) => {
      expect(() => assertContentMatchesExtension(ext, buffer)).toThrow(
        `CONTENT_TYPE_MISMATCH:${ext}`,
      );
    });
  });

  describe('text extensions, where there is no signature to check', () => {
    it.each([...TEXT_EXTENSIONS])('accepts real text as %s', (ext) => {
      expect(() => assertContentMatchesExtension(ext, TEXT)).not.toThrow();
      expect(() => assertContentMatchesExtension(ext, Buffer.alloc(0))).not.toThrow();
    });

    // What IS checkable: a text extension must not carry a known binary container.
    it.each([
      ['pdf', PDF],
      ['zip', ZIP],
      ['png', PNG],
      ['jpeg', JPEG],
      ['ole2', OLE2],
    ])('rejects a .txt that is really %s', (_label, buffer) => {
      expect(() => assertContentMatchesExtension('txt', buffer)).toThrow(
        'CONTENT_TYPE_MISMATCH:txt',
      );
    });
  });

  describe('HEIC brand', () => {
    it.each(['heic', 'heix', 'hevc', 'mif1'])('accepts the %s brand', (brand) => {
      expect(() => assertContentMatchesExtension('heic', isoBmff(brand))).not.toThrow();
    });

    // ISO-BMFF also carries MP4 and QuickTime; only the HEIC brands are images here.
    it.each(['mp42', 'isom', 'qt  ', 'avif'])('rejects the %s brand', (brand) => {
      expect(() => assertContentMatchesExtension('heic', isoBmff(brand))).toThrow(
        'CONTENT_TYPE_MISMATCH:heic',
      );
    });

    it('rejects a truncated ISO-BMFF header rather than reading past it', () => {
      const truncated = Buffer.concat([bytes(0, 0, 0, 0x18), Buffer.from('ftyp', 'latin1')]);
      expect(() => assertContentMatchesExtension('heic', truncated)).toThrow(
        'CONTENT_TYPE_MISMATCH:heic',
      );
    });
  });

  it('rejects a .doc that is not an OLE2 container', () => {
    // .doc is recognised but not connected; it must still not reach that branch
    // by carrying something else entirely.
    expect(() => assertContentMatchesExtension('doc', ZIP)).toThrow('CONTENT_TYPE_MISMATCH:doc');
    expect(() => assertContentMatchesExtension('doc', OLE2)).not.toThrow();
  });

  it('leaves an unknown extension to the route, which rejects it by name', () => {
    expect(() => assertContentMatchesExtension('exe', OLE2)).not.toThrow();
  });
});

/**
 * Polyglot and ambiguity: pinning what the control actually does, so the claim
 * cannot quietly grow. Detection keys on the leading signature, so a polyglot
 * is admitted only under the extension matching that signature and refused
 * under every other one. That is the safe direction, and it is not the same as
 * being polyglot-proof.
 */
describe('polyglot and ambiguous content', () => {
  const ZIP_HEAD = bytes(0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0);
  const PDF_HEAD = Buffer.from('%PDF-1.7\n', 'latin1');

  it.each([
    ['a PDF header over a ZIP body', Buffer.concat([PDF_HEAD, ZIP_HEAD]), 'pdf'],
    ['a ZIP header over a PDF body', Buffer.concat([ZIP_HEAD, PDF_HEAD]), 'zip'],
    ['a PNG header over a ZIP body', Buffer.concat([PNG, ZIP_HEAD]), 'png'],
  ])('%s is classified by its leading signature', (_label, buffer, expected) => {
    expect(detectContent(buffer)).toBe(expected);
  });

  it('admits a polyglot only under the extension its leading signature claims', () => {
    const polyglot = Buffer.concat([PDF_HEAD, ZIP_HEAD]);
    expect(() => assertContentMatchesExtension('pdf', polyglot)).not.toThrow();
    for (const ext of ['docx', 'xlsx', 'png', 'txt', 'heic']) {
      expect(() => assertContentMatchesExtension(ext, polyglot)).toThrow(
        `CONTENT_TYPE_MISMATCH:${ext}`,
      );
    }
  });

  it('does not distinguish docx from xlsx, and does not pretend to', () => {
    // Both are ZIP. The same archive satisfies both, by design; the extractors
    // are what fail on the wrong archive.
    expect(() => assertContentMatchesExtension('docx', ZIP)).not.toThrow();
    expect(() => assertContentMatchesExtension('xlsx', ZIP)).not.toThrow();
  });

  it('treats a truncated header as a mismatch rather than guessing', () => {
    for (const partial of [PDF_HEAD.subarray(0, 3), PNG.subarray(0, 4), ZIP_HEAD.subarray(0, 2)]) {
      expect(detectContent(partial)).toBeNull();
      expect(() => assertContentMatchesExtension('pdf', partial)).toThrow();
      expect(() => assertContentMatchesExtension('png', partial)).toThrow();
    }
  });
});

describe('MEDIA_TYPES', () => {
  it('covers every extension the route dispatches on', () => {
    const dispatched = [...TEXT_EXTENSIONS, 'png', 'jpg', 'jpeg', 'heic', 'pdf', 'docx', 'xlsx'];
    for (const ext of dispatched) expect(MEDIA_TYPES[ext]).toBeTruthy();
  });

  it('is server-side truth, so a client-declared type cannot appear in it', () => {
    expect(MEDIA_TYPES.png).toBe('image/png');
    expect(MEDIA_TYPES.pdf).toBe('application/pdf');
    expect(MEDIA_TYPES.xlsx).toContain('spreadsheetml');
  });
});
