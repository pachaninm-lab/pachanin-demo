import {
  assertXmlWellFormed,
  parseJsonBounded,
  parseSemicolonCsvBounded,
} from './role-eligibility-format-validation';

describe('Role Eligibility fail-closed structured input validation', () => {
  it('accepts bounded JSON and rejects malformed, over-deep and over-wide JSON', () => {
    expect(parseJsonBounded('{"active":true,"items":[1,2]}', 'FNS')).toEqual({ active: true, items: [1, 2] });
    expect(() => parseJsonBounded('{"active":', 'FNS')).toThrow('FNS_JSON_MALFORMED');
    expect(() => parseJsonBounded('{"a":{"b":{"c":1}}}', 'FNS', 1, 100)).toThrow('FNS_JSON_DEPTH_LIMIT');
    expect(() => parseJsonBounded('{"a":1,"b":2,"c":3}', 'FNS', 10, 2)).toThrow('FNS_JSON_KEY_LIMIT');
  });

  it('accepts ordinary XML and rejects malformed or dangerous XML fail-closed', () => {
    expect(() => assertXmlWellFormed('<?xml version="1.0"?><root><item id="1">ok &amp; safe</item></root>', 'FGIS_GRAIN')).not.toThrow();
    expect(() => assertXmlWellFormed('<root><item></root>', 'FGIS_GRAIN')).toThrow('FGIS_GRAIN_XML_TAG_MISMATCH');
    expect(() => assertXmlWellFormed('<root></root><other/>', 'FGIS_GRAIN')).toThrow('FGIS_GRAIN_XML_MULTIPLE_ROOTS');
    expect(() => assertXmlWellFormed('<root>&unknown;</root>', 'FGIS_GRAIN')).toThrow('FGIS_GRAIN_XML_ENTITY_FORBIDDEN');
    expect(() => assertXmlWellFormed('<root>ok &amp; safe & broken</root>', 'FGIS_GRAIN')).toThrow('FGIS_GRAIN_XML_ENTITY_MALFORMED');
    expect(() => assertXmlWellFormed('<root item=1/>', 'FGIS_GRAIN')).toThrow('FGIS_GRAIN_XML_ATTRIBUTE_MALFORMED');
    expect(() => assertXmlWellFormed('<root item="1" item="2"/>', 'FGIS_GRAIN')).toThrow('FGIS_GRAIN_XML_DUPLICATE_ATTRIBUTE');
    expect(() => assertXmlWellFormed('<!DOCTYPE root [<!ENTITY x SYSTEM "file:///etc/passwd">]><root>&x;</root>', 'FGIS_GRAIN'))
      .toThrow('FGIS_GRAIN_XML_EXTERNAL_ENTITY_FORBIDDEN');
    expect(() => assertXmlWellFormed('<root><!-- broken -- comment --></root>', 'FGIS_GRAIN')).toThrow('FGIS_GRAIN_XML_MALFORMED_COMMENT');
  });

  it('parses quoted semicolon CSV and rejects malformed or oversized CSV', () => {
    expect(parseSemicolonCsvBounded('inn;name\r\n7701;"AO ""Test"""', 'ROSACCREDITATION', {
      maxRows: 10, maxColumns: 4, maxCellChars: 64,
    })).toEqual([['inn', 'name'], ['7701', 'AO "Test"']]);
    expect(() => parseSemicolonCsvBounded('a;"unterminated', 'ROSACCREDITATION', {
      maxRows: 10, maxColumns: 4, maxCellChars: 64,
    })).toThrow('ROSACCREDITATION_CSV_MALFORMED');
    expect(() => parseSemicolonCsvBounded('a;b;c', 'ROSACCREDITATION', {
      maxRows: 10, maxColumns: 2, maxCellChars: 64,
    })).toThrow('ROSACCREDITATION_CSV_COLUMN_LIMIT');
    expect(() => parseSemicolonCsvBounded('a\nb\nc', 'ROSACCREDITATION', {
      maxRows: 2, maxColumns: 2, maxCellChars: 64,
    })).toThrow('ROSACCREDITATION_CSV_ROW_LIMIT');
  });
});
