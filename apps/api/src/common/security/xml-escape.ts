/**
 * Output encoding for XML documents this application generates.
 *
 * ASVS 5.0 V1.2.1 asks that output encoding be relevant for the context, so
 * that data cannot change the structure of the document carrying it. The
 * regulatory report builders in exports.service.ts interpolated deal fields
 * into XML with a plain template literal: `culture` and `region` are free-text
 * columns, so a deal whose culture read `</Культура><Инъекция/>` did not
 * produce a report describing that culture - it produced a different document.
 *
 * The FGIS-Grain codec already escaped correctly. It had its own private copy
 * of these two functions, which is how the export builders came to be written
 * without them: the control existed in the tree and was reachable from exactly
 * one place. Both now call these, so there is one implementation to be right.
 *
 * These functions do not throw. The codec asserts its own character rules
 * before calling, and keeps that behaviour; callers that cannot reject a
 * record - a regulatory export must still be produced - use `xmlText`, which
 * drops the characters XML 1.0 cannot represent at all.
 */

/**
 * Escapes the three characters that can change element content structure.
 *
 * Not `"` and `'`: inside element content they carry no meaning, and escaping
 * them there would corrupt ordinary text such as a company name. Attribute
 * values need them, which is what `escapeXmlAttribute` is for.
 */
export function escapeXmlText(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;');
}

/** Escapes element-content characters plus both quote forms, for attributes. */
export function escapeXmlAttribute(value: string): string {
  return escapeXmlText(value)
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&apos;');
}

/**
 * Removes the characters XML 1.0 forbids outright.
 *
 * Escaping cannot help here: there is no entity, numeric or named, that
 * represents U+0000 in XML 1.0. A parser rejects the document whatever we
 * write. Tab, newline and carriage return are the three control characters the
 * standard does allow, and are kept.
 */
export function removeForbiddenXmlCharacters(value: string): string {
  let output = '';
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    const isAllowedControl = code === 0x09 || code === 0x0a || code === 0x0d;
    if (code < 0x20 && !isAllowedControl) continue;
    if (code === 0xfffe || code === 0xffff) continue;
    output += character;
  }
  return output;
}

/**
 * The safe primitive for element content built from a database value.
 *
 * Coerces, drops what XML cannot carry, then escapes. Null and undefined
 * become the empty string rather than the strings "null" and "undefined",
 * which is what a template literal would have written into the report.
 */
export function xmlText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return escapeXmlText(removeForbiddenXmlCharacters(String(value)));
}

/** The same, for an attribute value. */
export function xmlAttribute(value: unknown): string {
  if (value === null || value === undefined) return '';
  return escapeXmlAttribute(removeForbiddenXmlCharacters(String(value)));
}
