import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FnsRsmpArchiveTopologyError,
  parseCentralDirectory,
  parseEocdTail,
} from './role-eligibility-fns-rsmp-archive-topology.mjs';

function centralEntry(name, {
  flags = 0x0800,
  method = 8,
  compressedBytes = 1200,
  decompressedBytes = 9000,
  localHeaderOffset = 0,
  diskStart = 0,
} = {}) {
  const nameBytes = Buffer.from(name, 'utf8');
  const out = Buffer.alloc(46 + nameBytes.length);
  out.writeUInt32LE(0x02014b50, 0);
  out.writeUInt16LE(20, 4);
  out.writeUInt16LE(20, 6);
  out.writeUInt16LE(flags, 8);
  out.writeUInt16LE(method, 10);
  out.writeUInt32LE(0x12345678, 16);
  out.writeUInt32LE(compressedBytes, 20);
  out.writeUInt32LE(decompressedBytes, 24);
  out.writeUInt16LE(nameBytes.length, 28);
  out.writeUInt16LE(0, 30);
  out.writeUInt16LE(0, 32);
  out.writeUInt16LE(diskStart, 34);
  out.writeUInt32LE(0, 38);
  out.writeUInt32LE(localHeaderOffset, 42);
  nameBytes.copy(out, 46);
  return out;
}

function eocd({ entries = 2, centralBytes = 120, centralOffset = 1000, comment = '' } = {}) {
  const commentBytes = Buffer.from(comment, 'utf8');
  const out = Buffer.alloc(22 + commentBytes.length);
  out.writeUInt32LE(0x06054b50, 0);
  out.writeUInt16LE(0, 4);
  out.writeUInt16LE(0, 6);
  out.writeUInt16LE(entries, 8);
  out.writeUInt16LE(entries, 10);
  out.writeUInt32LE(centralBytes, 12);
  out.writeUInt32LE(centralOffset, 16);
  out.writeUInt16LE(commentBytes.length, 20);
  commentBytes.copy(out, 22);
  return out;
}

function expectCode(fn, code) {
  assert.throws(fn, (error) => error instanceof FnsRsmpArchiveTopologyError && error.code === code);
}

test('accepts bounded XML central directory and preserves descriptor metadata', () => {
  const first = centralEntry('VO_RRMSPSV_0001.xml', { localHeaderOffset: 0 });
  const second = centralEntry('VO_RRMSPSV_0002.xml', { localHeaderOffset: 4096, flags: 0x0808, compressedBytes: 1800, decompressedBytes: 12000 });
  const bytes = Buffer.concat([first, second]);
  const parsed = parseCentralDirectory(bytes, 2);
  assert.equal(parsed.entries.length, 2);
  assert.equal(parsed.entries[1].usesDataDescriptor, true);
  assert.deepEqual(parsed.summary.compressionMethods, [8]);
  assert.equal(parsed.summary.descriptorEntries, 1);
  assert.equal(parsed.summary.totalCompressedBytes, 3000);
  assert.equal(parsed.summary.totalDecompressedBytes, 21000);
});

test('rejects encrypted entries fail closed', () => {
  const bytes = centralEntry('VO_RRMSPSV_0001.xml', { flags: 0x0801 });
  expectCode(() => parseCentralDirectory(bytes, 1), 'FNS_RSMP_TOPOLOGY_ENCRYPTION_FORBIDDEN');
});

test('rejects traversal and non-XML archive members', () => {
  expectCode(
    () => parseCentralDirectory(centralEntry('../escape.xml'), 1),
    'FNS_RSMP_TOPOLOGY_ENTRY_PATH_TRAVERSAL',
  );
  expectCode(
    () => parseCentralDirectory(centralEntry('readme.txt'), 1),
    'FNS_RSMP_TOPOLOGY_NON_XML_ENTRY_FORBIDDEN',
  );
});

test('rejects ZIP64 sentinel values', () => {
  const bytes = centralEntry('VO_RRMSPSV_0001.xml', { compressedBytes: 0xffffffff });
  expectCode(() => parseCentralDirectory(bytes, 1), 'FNS_RSMP_TOPOLOGY_ZIP64_FORBIDDEN');
});

test('parses EOCD only when central directory ends immediately before it', () => {
  const centralOffset = 4096;
  const centralBytes = 512;
  const archiveBytes = centralOffset + centralBytes + 22;
  const tail = eocd({ entries: 7, centralBytes, centralOffset });
  const parsed = parseEocdTail(tail, centralOffset + centralBytes, archiveBytes);
  assert.equal(parsed.totalEntries, 7);
  assert.equal(parsed.centralOffset, centralOffset);
  assert.equal(parsed.centralBytes, centralBytes);
});

test('rejects multi-disk EOCD', () => {
  const bytes = eocd({ entries: 1, centralBytes: 64, centralOffset: 100 });
  bytes.writeUInt16LE(1, 4);
  expectCode(
    () => parseEocdTail(bytes, 164, 164 + bytes.length),
    'FNS_RSMP_TOPOLOGY_MULTIDISK_FORBIDDEN',
  );
});
