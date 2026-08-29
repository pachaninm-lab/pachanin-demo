export const PRESENTATION_GEKTA_FRAME_PATCH_MARKER =
  '% PC-GEKTA-FRAME-PATCH-V1';

const OVERLAY_STREAM =
  [
    'q',
    '0.0588379 0.462646 0.431396 rg',
    '39.55 204.00 m',
    '277.25 204.00 l',
    '277.25 193.30 l',
    '277.25 190.26 274.79 187.80 271.75 187.80 c',
    '45.05 187.80 l',
    '42.01 187.80 39.55 190.26 39.55 193.30 c',
    'h f',
    'Q',
  ].join('\n') + '\n';

function requiredMatch(
  value: string,
  pattern: RegExp,
  label: string,
): RegExpMatchArray {
  const match = value.match(pattern);
  if (!match) {
    throw new Error(`Presentation PDF ${label} was not found.`);
  }
  return match;
}

function xrefEntry(offset: number): string {
  return `${String(offset).padStart(10, '0')} 00000 n`;
}

export function applyPresentationGektaFramePatch(pdf: Buffer): Buffer {
  if (pdf.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new Error('Presentation source is not a PDF.');
  }

  const text = pdf.toString('latin1');
  if (text.includes(PRESENTATION_GEKTA_FRAME_PATCH_MARKER)) {
    throw new Error('Presentation Gekta frame patch is already applied.');
  }

  const startXrefMatch = requiredMatch(
    text,
    /startxref\s+(\d+)\s+%%EOF\s*$/,
    'final startxref',
  );
  const previousStartXref = Number(startXrefMatch[1]);
  if (
    !Number.isSafeInteger(previousStartXref) ||
    previousStartXref <= 0 ||
    previousStartXref >= pdf.byteLength
  ) {
    throw new Error('Presentation PDF startxref is invalid.');
  }

  const xrefText = text.slice(
    previousStartXref,
    Math.min(text.length, previousStartXref + 8192),
  );
  const xrefObject = requiredMatch(
    xrefText,
    /^(\d+)\s+0\s+obj\s*<<(.*?)>>/s,
    'xref stream dictionary',
  );
  const dictionary = xrefObject[2];
  if (/\/Encrypt\b/.test(dictionary)) {
    throw new Error('Encrypted presentation PDFs are not supported.');
  }

  const size = Number(requiredMatch(dictionary, /\/Size\s+(\d+)/, 'xref Size')[1]);
  const rootObject = Number(
    requiredMatch(dictionary, /\/Root\s+(\d+)\s+0\s+R/, 'Root reference')[1],
  );
  const infoMatch = dictionary.match(/\/Info\s+(\d+)\s+0\s+R/);
  const idMatch = dictionary.match(
    /\/ID\s*(\[\s*<[^>]+>\s*<[^>]+>\s*\])/s,
  );
  if (!Number.isSafeInteger(size) || size <= 0) {
    throw new Error('Presentation PDF xref Size is invalid.');
  }

  const pageObjectMarker = '\n4 0 obj';
  let pageObjectOffset = text.indexOf(pageObjectMarker);
  if (pageObjectOffset < 0 && text.startsWith('4 0 obj')) {
    pageObjectOffset = 0;
  }
  if (pageObjectOffset < 0) {
    throw new Error('Presentation PDF first page object was not found.');
  }

  const pageObjectEnd = text.indexOf('endobj', pageObjectOffset);
  if (pageObjectEnd < 0) {
    throw new Error('Presentation PDF first page object is incomplete.');
  }

  const pageObjectNumber = 4;
  const pageObject = text
    .slice(pageObjectOffset, pageObjectEnd + 'endobj'.length)
    .replace(/^\n/, '')
    .trim();
  if (
    !/\/Type\s*\/Page\b/.test(pageObject) ||
    !/\/MediaBox\s*\[\s*0\s+0\s+960(?:\.0?1)?\s+540\s*\]/.test(pageObject)
  ) {
    throw new Error('Presentation PDF first page geometry is unexpected.');
  }

  const contentsObject = Number(
    requiredMatch(
      pageObject,
      /\/Contents\s+(\d+)\s+0\s+R/,
      'page Contents reference',
    )[1],
  );
  const newObjectNumber = size;
  const updatedPageObject = pageObject.replace(
    /\/Contents\s+\d+\s+0\s+R/,
    `/Contents [${newObjectNumber} 0 R ${contentsObject} 0 R]`,
  );
  if (updatedPageObject === pageObject) {
    throw new Error('Presentation PDF page Contents could not be patched.');
  }

  const prefix = `\n${PRESENTATION_GEKTA_FRAME_PATCH_MARKER}\n`;
  const overlayObject =
    `${newObjectNumber} 0 obj\n` +
    `<< /Length ${Buffer.byteLength(OVERLAY_STREAM, 'ascii')} >>\n` +
    `stream\n${OVERLAY_STREAM}endstream\nendobj\n`;
  const pageRevision = `${updatedPageObject}\n`;

  const overlayOffset = pdf.byteLength + Buffer.byteLength(prefix, 'ascii');
  const pageOffset = overlayOffset + Buffer.byteLength(overlayObject, 'ascii');
  const xrefOffset = pageOffset + Buffer.byteLength(pageRevision, 'latin1');
  const infoTrailer = infoMatch ? ` /Info ${infoMatch[1]} 0 R` : '';
  const idTrailer = idMatch ? ` /ID ${idMatch[1]}` : '';
  const xrefAndTrailer = [
    'xref',
    `${pageObjectNumber} 1`,
    xrefEntry(pageOffset),
    `${newObjectNumber} 1`,
    xrefEntry(overlayOffset),
    'trailer',
    `<< /Size ${newObjectNumber + 1} /Root ${rootObject} 0 R${infoTrailer}${idTrailer} /Prev ${previousStartXref} >>`,
    'startxref',
    String(xrefOffset),
    '%%EOF',
    '',
  ].join('\n');

  return Buffer.concat([
    pdf,
    Buffer.from(prefix, 'ascii'),
    Buffer.from(overlayObject, 'ascii'),
    Buffer.from(pageRevision, 'latin1'),
    Buffer.from(xrefAndTrailer, 'ascii'),
  ]);
}
