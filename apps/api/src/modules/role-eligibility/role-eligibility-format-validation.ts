import type { EligibilitySource } from './role-eligibility.types';
import { assertJsonDepth, assertXmlSafe } from './role-eligibility-security';

function sourceError(source: EligibilitySource, code: string): Error {
  return new Error(`${source}_${code}`);
}

export function parseJsonBounded(
  text: string,
  source: EligibilitySource,
  maxDepth = 24,
  maxKeys = 50_000,
): unknown {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw sourceError(source, 'JSON_MALFORMED');
  }
  try {
    assertJsonDepth(value, maxDepth, maxKeys);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'JSON_INVALID';
    throw sourceError(source, code);
  }
  return value;
}

function validateXmlEntities(text: string, source: EligibilitySource): void {
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== '&') continue;
    const end = text.indexOf(';', index + 1);
    if (end < 0 || end - index > 81) throw sourceError(source, 'XML_ENTITY_MALFORMED');
    const name = text.slice(index + 1, end);
    if (!/^(?:amp|lt|gt|apos|quot|#\d+|#x[0-9a-f]+)$/i.test(name)) {
      throw sourceError(source, 'XML_ENTITY_FORBIDDEN');
    }
    index = end;
  }
}

function scanXmlTagEnd(xml: string, start: number, source: EligibilitySource): number {
  let quote: '"' | "'" | null = null;
  for (let index = start + 1; index < xml.length; index += 1) {
    const char = xml[index];
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '>') return index;
  }
  throw sourceError(source, 'XML_MALFORMED');
}

/**
 * Dependency-free fail-closed structural validator used before any source-
 * specific XML normalization. It deliberately accepts only ordinary XML 1.x
 * constructs needed by registry feeds and rejects DTD/entity declarations.
 */
export function assertXmlWellFormed(xml: string, source: EligibilitySource): void {
  assertXmlSafe(xml, source);
  validateXmlEntities(xml, source);
  const stack: string[] = [];
  let roots = 0;
  let index = 0;
  let rootClosed = false;

  while (index < xml.length) {
    const next = xml.indexOf('<', index);
    if (next < 0) {
      if (rootClosed && xml.slice(index).trim()) throw sourceError(source, 'XML_MULTIPLE_ROOTS');
      break;
    }
    const text = xml.slice(index, next);
    if ((stack.length === 0 || rootClosed) && text.trim()) throw sourceError(source, 'XML_TEXT_OUTSIDE_ROOT');

    if (xml.startsWith('<!--', next)) {
      const end = xml.indexOf('-->', next + 4);
      if (end < 0 || xml.slice(next + 4, end).includes('--')) throw sourceError(source, 'XML_MALFORMED_COMMENT');
      index = end + 3;
      continue;
    }
    if (xml.startsWith('<![CDATA[', next)) {
      if (stack.length === 0) throw sourceError(source, 'XML_CDATA_OUTSIDE_ROOT');
      const end = xml.indexOf(']]>', next + 9);
      if (end < 0) throw sourceError(source, 'XML_MALFORMED_CDATA');
      index = end + 3;
      continue;
    }
    if (xml.startsWith('<?', next)) {
      const end = xml.indexOf('?>', next + 2);
      if (end < 0) throw sourceError(source, 'XML_MALFORMED_PROCESSING_INSTRUCTION');
      index = end + 2;
      continue;
    }
    if (xml.startsWith('<!', next)) throw sourceError(source, 'XML_DECLARATION_FORBIDDEN');

    const end = scanXmlTagEnd(xml, next, source);
    const raw = xml.slice(next + 1, end).trim();
    if (!raw) throw sourceError(source, 'XML_MALFORMED');
    if (raw.startsWith('/')) {
      const name = raw.slice(1).trim();
      if (!/^[A-Za-z_][\w:.-]*$/.test(name)) throw sourceError(source, 'XML_MALFORMED_CLOSE_TAG');
      if (stack.pop() !== name) throw sourceError(source, 'XML_TAG_MISMATCH');
      if (stack.length === 0) rootClosed = true;
    } else {
      const selfClosing = /\/$/.test(raw);
      const body = selfClosing ? raw.slice(0, -1).trim() : raw;
      const nameMatch = body.match(/^([A-Za-z_][\w:.-]*)(?:\s|$)/);
      if (!nameMatch) throw sourceError(source, 'XML_MALFORMED_OPEN_TAG');
      const name = nameMatch[1];
      if (stack.length === 0) {
        if (rootClosed || roots > 0) throw sourceError(source, 'XML_MULTIPLE_ROOTS');
        roots += 1;
      }
      if (!selfClosing) stack.push(name);
      else if (stack.length === 0) rootClosed = true;
    }
    index = end + 1;
  }

  if (roots !== 1 || stack.length !== 0) throw sourceError(source, 'XML_MALFORMED');
}

export function parseSemicolonCsvBounded(
  text: string,
  source: EligibilitySource,
  limits: { maxRows: number; maxColumns: number; maxCellChars: number },
): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  const pushCell = () => {
    if (cell.length > limits.maxCellChars) throw sourceError(source, 'CSV_CELL_LIMIT');
    row.push(cell);
    cell = '';
    if (row.length > limits.maxColumns) throw sourceError(source, 'CSV_COLUMN_LIMIT');
  };
  const pushRow = () => {
    pushCell();
    rows.push(row);
    row = [];
    if (rows.length > limits.maxRows) throw sourceError(source, 'CSV_ROW_LIMIT');
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (!quoted && cell.length === 0) {
        quoted = true;
      } else if (quoted) {
        quoted = false;
        const next = text[index + 1];
        if (next && ![';', '\r', '\n'].includes(next)) throw sourceError(source, 'CSV_MALFORMED');
      } else {
        throw sourceError(source, 'CSV_MALFORMED');
      }
      continue;
    }
    if (!quoted && char === ';') {
      pushCell();
      continue;
    }
    if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      pushRow();
      continue;
    }
    cell += char;
    if (cell.length > limits.maxCellChars) throw sourceError(source, 'CSV_CELL_LIMIT');
  }
  if (quoted) throw sourceError(source, 'CSV_MALFORMED');
  if (cell.length || row.length) pushRow();
  return rows;
}
