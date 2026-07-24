import { TextDecoder } from 'node:util';
import {
  FgisGrainXmlCodecError,
  buildUnsignedFgisGrainSoapEnvelope,
  decodeFgisGrainSoapEnvelope,
  type FgisGrainBuildUnsignedSoapEnvelopeInput,
  type FgisGrainSoapDecodeOptions,
} from './fgis-grain-1.0.23.xml-codec';

export const FGIS_GRAIN_XINCLUDE_NAMESPACE =
  'http://www.w3.org/2001/XInclude' as const;

const FATAL_UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });
const XMLNS_ATTRIBUTE_PATTERN =
  /(?:^|\s)xmlns(?::[A-Za-z_][A-Za-z0-9._-]*)?\s*=\s*(?:"([^"]*)"|'([^']*)')/gu;

function decodeNamespaceValue(value: string): string {
  return value.replace(
    /&(amp|lt|gt|quot|apos|#\d{1,7}|#x[\da-f]{1,6});/giu,
    (reference) => {
      const entity = reference.slice(1, -1);
      const predefined: Readonly<Record<string, string>> = {
        amp: '&',
        lt: '<',
        gt: '>',
        quot: '"',
        apos: "'",
      };
      const named = predefined[entity.toLowerCase()];
      if (named !== undefined) return named;
      const codePoint = entity.toLowerCase().startsWith('#x')
        ? Number.parseInt(entity.slice(2), 16)
        : Number.parseInt(entity.slice(1), 10);
      if (
        !Number.isInteger(codePoint)
        || codePoint < 0
        || codePoint > 0x10ffff
        || (codePoint >= 0xd800 && codePoint <= 0xdfff)
      ) {
        throw new FgisGrainXmlCodecError(
          'INVALID_ENTITY_REFERENCE',
          `Invalid namespace character reference ${reference}`,
        );
      }
      return String.fromCodePoint(codePoint);
    },
  );
}

function xmlText(value: string | Uint8Array): string | null {
  if (typeof value === 'string') return value;
  try {
    return FATAL_UTF8_DECODER.decode(value);
  } catch {
    return null;
  }
}

export function assertFgisGrainXIncludeForbidden(
  value: string | Uint8Array,
): void {
  const xml = xmlText(value);
  if (xml === null) return;
  XMLNS_ATTRIBUTE_PATTERN.lastIndex = 0;
  for (const match of xml.matchAll(XMLNS_ATTRIBUTE_PATTERN)) {
    const rawNamespace = match[1] ?? match[2] ?? '';
    if (decodeNamespaceValue(rawNamespace) === FGIS_GRAIN_XINCLUDE_NAMESPACE) {
      throw new FgisGrainXmlCodecError(
        'CALLER_SIGNATURE_OR_TRANSPORT_WRAPPER_FORBIDDEN',
        'XInclude namespace is forbidden at the FGIS Grain XML boundary',
      );
    }
  }
}

export function decodeGovernedFgisGrainSoapEnvelope(
  input: string | Uint8Array,
  options: FgisGrainSoapDecodeOptions = {},
) {
  assertFgisGrainXIncludeForbidden(input);
  return decodeFgisGrainSoapEnvelope(input, options);
}

export function buildGovernedUnsignedFgisGrainSoapEnvelope(
  input: FgisGrainBuildUnsignedSoapEnvelopeInput,
) {
  if (input.businessPayloadXml !== undefined) {
    assertFgisGrainXIncludeForbidden(input.businessPayloadXml);
  }
  return buildUnsignedFgisGrainSoapEnvelope(input);
}
