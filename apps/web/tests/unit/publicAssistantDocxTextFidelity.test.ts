// @vitest-environment node
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { POST } from '../../app/api/public-platform-assistant/attachments/route';

// Real stored ZIP records with CRC-32, not a mocked archive/extractor.
function docx(body: string, prefix = 'w'): Buffer {
  const name = Buffer.from('word/document.xml');
  const q = prefix ? `${prefix}:` : '';
  const namespace = prefix ? `xmlns:${prefix}` : 'xmlns';
  const data = Buffer.from(`<${q}document ${namespace}="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><${q}body>${body.replace(/w:/gu, q)}</${q}body></${q}document>`);
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  crc = (crc ^ 0xffffffff) >>> 0;
  const local = Buffer.alloc(30 + name.length);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  name.copy(local, 30);
  const central = Buffer.alloc(46 + name.length);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(name.length, 28);
  name.copy(central, 46);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(local.length + data.length, 16);
  return Buffer.concat([local, data, central, end]);
}

async function upload(body: string, prefix = 'w') {
  const form = new FormData();
  form.append('files', new File([new Uint8Array(docx(body, prefix))], 'synthetic.docx'));
  const response = await POST(new NextRequest('http://localhost/api/public-platform-assistant/attachments', {
    method: 'POST', body: form,
  }));
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result.rejected).toEqual([]);
  return result.documents[0] as { text: string; truncated: boolean };
}

const paragraph = (text: string) => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;

describe('public assistant real DOCX text fidelity', () => {
  it('preserves literal comparison signs without treating text as markup', async () => {
    const { text } = await upload(paragraph('Сумма &lt; 5000 и &gt; 1000. A &lt; B и C &gt; D.'));
    expect(text).toBe('Сумма < 5000 и > 1000. A < B и C > D.');
  });
  it('decodes numeric XML entities exactly once', async () => {
    const { text } = await upload(paragraph('Влажность &#60; 14; белок &#x3E; 12. &amp;lt;tag&amp;gt; &quot;овёс&quot;'));
    expect(text).toBe('Влажность < 14; белок > 12. &lt;tag&gt; "овёс"');
  });
  it('preserves a word split across formatting runs', async () => {
    const { text } = await upload('<w:p><w:r><w:t>Пше</w:t></w:r><w:r><w:t>ница</w:t></w:r></w:p>');
    expect(text).toBe('Пшеница');
  });
  it('keeps paragraph and table-cell boundaries', async () => {
    const { text } = await upload('<w:tbl><w:tr><w:tc>' + paragraph('Цена') + '</w:tc><w:tc>' + paragraph('18000') + '</w:tc></w:tr></w:tbl>' + paragraph('Итого'));
    expect(text).toMatch(/Цена\s+18000\s+Итого/u);
  });
  it.each([
    ['del', 'Удалено'], ['ins', 'Вставлено'],
    ['moveFrom', 'Перенесено из'], ['moveTo', 'Перенесено в'],
  ])('distinguishes %s tracked text from ordinary contract text', async (tag, label) => {
    const textTag = tag === 'del' ? 'delText' : 't';
    const changed = `<w:${tag} w:id="1"><w:r><w:${textTag}>Цена 20000</w:${textTag}></w:r></w:${tag}>`;
    const { text } = await upload(paragraph('Цена 18000') + changed);
    expect(text).toContain('правки');
    expect(text).toContain(`[${label} (правка)]Цена 20000[Конец правки]`);
    expect(text).toContain('не подтверждает принятие изменений');
    expect(text).toContain('Цена 18000');
  });
  it('does not turn a self-closing revision property into a text wrapper', async () => {
    const { text } = await upload('<w:p><w:pPr><w:rPr><w:del w:id="2"/></w:rPr></w:pPr><w:r><w:t>Цена 18000</w:t></w:r></w:p>');
    expect(text).toBe('Цена 18000');
  });
  it.each(['d', ''])('resolves tracked text through the namespace URI with prefix %s', async (prefix) => {
    const { text } = await upload(paragraph('Цена 18000') + '<w:del w:id="1"><w:r><w:delText>Цена 20000</w:delText></w:r></w:del>', prefix);
    expect(text).toContain('[Удалено (правка)]Цена 20000[Конец правки]');
    expect(text).toContain('не подтверждает принятие изменений');
  });
  it('ignores pretty printing outside text nodes but preserves intentional spaces inside them', async () => {
    const { text } = await upload('<w:p>\n  <w:r><w:t>Пше</w:t></w:r>\n  <w:r><w:t>ница</w:t></w:r>\n  <w:r><w:t xml:space="preserve"> и овёс</w:t></w:r>\n</w:p>');
    expect(text).toBe('Пшеница и овёс');
  });
  it('does not interpret a rebound foreign prefix as Word text or a revision', async () => {
    const { text } = await upload(paragraph('Цена 18000') + '<w:del xmlns:w="urn:foreign"><w:r><w:t>NOT_WORD</w:t></w:r></w:del>');
    expect(text).toBe('Цена 18000');
  });
  it('does not read a namespace-like string inside an author attribute as a declaration', async () => {
    const { text } = await upload(paragraph('Цена 18000') + `<w:del w:id="1" w:author="Alice xmlns:w='urn:foreign'"><w:r><w:delText>Цена 20000</w:delText></w:r></w:del>`);
    expect(text).toContain('[Удалено (правка)]Цена 20000[Конец правки]');
    expect(text).toContain('не подтверждает принятие изменений');
  });
  it('keeps CDATA literal and does not expand entities again', async () => {
    const { text } = await upload('<w:p><w:r><w:t><![CDATA[<5000 &amp; >1000]]></w:t></w:r></w:p>');
    expect(text).toBe('<5000 &amp; >1000');
  });
  it('keeps the 18000-character ceiling and reports partial extraction', async () => {
    const { text, truncated } = await upload(paragraph('Данные '.repeat(4000)));
    expect(text.length).toBe(18000);
    expect(truncated).toBe(true);
  });
});
