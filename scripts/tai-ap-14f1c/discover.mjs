#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promises as dns } from 'node:dns';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOST = 'rosstat.gov.ru';
const DATASET = '7708234640-VSHP2016254';
const BASE_PATH = `/opendata/${DATASET}`;
const SOURCE_ID = 'official.rosstat.opendata.7708234640-vshp2016254';
const DEFAULT_MANIFEST = `apps/tai/knowledge-sources/AP-14F1C-ROSSTAT-${DATASET}.v1.json`;
const DEFAULT_OUTPUT = 'artifacts/tai-ap-14f1c/rosstat-resource-evidence.json';
const REQUIRED_CODES = ['DATASET_PAGE', 'PASSPORT_CSV', 'SDMX_STRUCTURE_XML', 'DATA_XML'];
const SHA256 = /^[0-9a-f]{64}$/;
const SDMX_MESSAGE_NS = 'http://www.sdmx.org/resources/sdmxml/schemas/v2_0/message';
const SDMX_STRUCTURE_NS = 'http://www.sdmx.org/resources/sdmxml/schemas/v2_0/structure';
const SDMX_COMMON_NS = 'http://www.sdmx.org/resources/sdmxml/schemas/v2_0/common';

function fail(code, detail = '') {
  throw new Error(`${code}${detail ? `: ${detail}` : ''}`);
}

function errorCode(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.split(':', 1)[0].trim() || 'ROSSTAT_UNKNOWN_FAILURE';
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function assertExactRoute(resource) {
  const uri = new URL(resource.uri);
  if (uri.protocol !== 'https:') fail('ROSSTAT_HTTPS_REQUIRED', resource.code);
  if (uri.hostname !== HOST || uri.port) fail('ROSSTAT_HOST_PIN_MISMATCH', resource.code);
  if (uri.username || uri.password || uri.search || uri.hash) {
    fail('ROSSTAT_URI_CREDENTIAL_QUERY_OR_FRAGMENT', resource.code);
  }
  if (uri.pathname !== resource.path) fail('ROSSTAT_PATH_PIN_MISMATCH', resource.code);
  if (uri.pathname !== BASE_PATH && !uri.pathname.startsWith(`${BASE_PATH}/`)) {
    fail('ROSSTAT_SEGMENT_BOUNDED_PATH_ESCAPE', resource.code);
  }
}

function isGlobalIpv4(address) {
  const parts = address.split('.').map(Number);
  if (
    parts.length !== 4
    || parts.some((value) => !Number.isInteger(value) || value < 0 || value > 255)
  ) {
    return false;
  }
  const [a, b, c] = parts;
  if ([0, 10, 127].includes(a) || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 0 && [0, 2].includes(c)) return false;
  if (a === 198 && [18, 19].includes(b)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

async function pinnedDns() {
  const observed = [...new Set(await dns.resolve4(HOST))].sort((left, right) => {
    const leftParts = left.split('.').map(Number);
    const rightParts = right.split('.').map(Number);
    for (let index = 0; index < 4; index += 1) {
      if (leftParts[index] !== rightParts[index]) {
        return leftParts[index] - rightParts[index];
      }
    }
    return 0;
  });
  if (observed.length === 0) fail('ROSSTAT_DNS_EMPTY');
  const rejected = observed.filter((address) => !isGlobalIpv4(address));
  if (rejected.length > 0) fail('ROSSTAT_DNS_NON_GLOBAL', rejected.join(','));
  return { selected: observed[0], observed };
}

function parseHeaders(raw) {
  const blocks = raw
    .replaceAll('\r\n', '\n')
    .split(/\n\n+/)
    .filter((block) => block.trim().startsWith('HTTP/'));
  if (blocks.length !== 1) {
    fail('ROSSTAT_REDIRECT_OR_PROXY_HEADER_CHAIN', String(blocks.length));
  }
  const lines = blocks[0].split('\n').filter(Boolean);
  const statusLine = lines.shift() ?? '';
  const match = statusLine.match(/^HTTP\/\S+\s+(\d{3})\b/);
  if (!match) fail('ROSSTAT_HTTP_STATUS_INVALID');
  const headers = {};
  for (const line of lines) {
    const separator = line.indexOf(':');
    if (separator < 1) fail('ROSSTAT_HEADER_INVALID', line);
    const name = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim().replace(/\s+/g, ' ');
    if (!name || value.includes('\r') || value.includes('\n')) {
      fail('ROSSTAT_HEADER_INVALID', name);
    }
    headers[name] = headers[name] ? `${headers[name]}, ${value}` : value;
  }
  return { status: Number(match[1]), headers };
}

function headerDigest(headers) {
  return digest(Buffer.from(
    Object.entries(headers)
      .map(([name, value]) => `${name}:${value}`)
      .sort()
      .join('\n'),
  ));
}

function decodeUtf16Be(body, offset = 0) {
  const length = body.length - offset - ((body.length - offset) % 2);
  const swapped = Buffer.from(body.subarray(offset, offset + length));
  swapped.swap16();
  return swapped.toString('utf16le');
}

function decodeXmlText(body) {
  if (body.length >= 3 && body[0] === 0xef && body[1] === 0xbb && body[2] === 0xbf) {
    return body.subarray(3).toString('utf8');
  }
  if (body.length >= 2 && body[0] === 0xff && body[1] === 0xfe) {
    return body.subarray(2).toString('utf16le');
  }
  if (body.length >= 2 && body[0] === 0xfe && body[1] === 0xff) {
    return decodeUtf16Be(body, 2);
  }
  if (
    body.length >= 4
    && body[0] === 0x3c
    && body[1] === 0x00
    && body[2] === 0x3f
    && body[3] === 0x00
  ) {
    return body.toString('utf16le');
  }
  if (
    body.length >= 4
    && body[0] === 0x00
    && body[1] === 0x3c
    && body[2] === 0x00
    && body[3] === 0x3f
  ) {
    return decodeUtf16Be(body);
  }
  return body.toString('utf8');
}

function normalizedXml(body, resourceCode) {
  const xml = decodeXmlText(body).replace(/^\uFEFF/, '').trimStart();
  const lowered = xml.toLowerCase();
  if (!lowered.startsWith('<')) {
    fail(
      'ROSSTAT_XML_SIGNATURE_MISMATCH',
      `${resourceCode}:${body.subarray(0, 16).toString('hex')}`,
    );
  }
  if (lowered.startsWith('<html') || lowered.startsWith('<!doctype html')) {
    fail('ROSSTAT_XML_HTML_MISMATCH', resourceCode);
  }
  if (
    lowered.includes('<!doctype')
    || lowered.includes('<!entity')
    || lowered.includes('<xi:include')
  ) {
    fail('ROSSTAT_XML_EXTERNAL_OR_ENTITY_FORBIDDEN', resourceCode);
  }
  return { xml, lowered };
}

function assertSdmxStructure(xml, lowered) {
  const compactHead = lowered.slice(0, 4096).replace(/\s+/g, ' ');
  if (!/<(?:\w+:)?structure(?:\s|>)/i.test(xml)) {
    fail('ROSSTAT_SDMX_STRUCTURE_ROOT_MISSING', compactHead.slice(0, 512));
  }
  for (const namespace of [SDMX_MESSAGE_NS, SDMX_STRUCTURE_NS, SDMX_COMMON_NS]) {
    if (!lowered.includes(namespace.toLowerCase())) {
      fail('ROSSTAT_SDMX_NAMESPACE_MISSING', namespace);
    }
  }
  if (!/<(?:\w+:)?header(?:\s|>)/i.test(xml)) {
    fail('ROSSTAT_SDMX_HEADER_MISSING');
  }
  if (!/<(?:\w+:)?id(?:\s|>)[^<]*7708234640-vshp2016-254/i.test(xml)) {
    fail('ROSSTAT_SDMX_DATASET_ID_MISMATCH');
  }
  if (/<(?:xs|xsd):schema(?:\s|>)/i.test(xml)) {
    fail('ROSSTAT_SDMX_RESOURCE_IS_UNEXPECTED_XSD');
  }
}

function assertBody(resource, body) {
  const latinHead = body.subarray(0, 1024).toString('latin1').trimStart().toLowerCase();
  if (resource.code === 'DATASET_PAGE') {
    const text = body.toString('utf8').replace(/^\uFEFF/, '');
    for (const marker of [
      DATASET,
      'meta.csv',
      'structure-20181211T0212.xsd',
      'data-20181211T0212-structure-20181211T0212.xml',
    ]) {
      if (!text.includes(marker)) fail('ROSSTAT_PAGE_MARKER_MISSING', marker);
    }
    return;
  }

  if (resource.code === 'PASSPORT_CSV') {
    if (latinHead.startsWith('<html') || latinHead.startsWith('<!doctype html')) {
      fail('ROSSTAT_CSV_HTML_MISMATCH');
    }
    const text = body.toString('latin1');
    for (const marker of [
      DATASET,
      'structure-20181211T0212.xsd',
      'data-20181211T0212-structure-20181211T0212.xml',
    ]) {
      if (!text.includes(marker)) fail('ROSSTAT_CSV_MARKER_MISSING', marker);
    }
    return;
  }

  const { xml, lowered } = normalizedXml(body, resource.code);
  if (resource.code === 'SDMX_STRUCTURE_XML') {
    assertSdmxStructure(xml, lowered);
  }
}

function validateManifest(manifest) {
  if (manifest.schemaVersion !== 'tai.ap14f1c-rosstat-dataset.v1') {
    fail('ROSSTAT_SCHEMA_VERSION');
  }
  if (manifest.datasetCode !== DATASET || manifest.sourceId !== SOURCE_ID) {
    fail('ROSSTAT_IDENTITY');
  }
  if (manifest.operationalStatus !== 'NOT_ATTESTED') {
    fail('ROSSTAT_OPERATIONAL_STATUS');
  }
  if (manifest.productionHosting !== 'REG_RU_VPS_ONLY') {
    fail('ROSSTAT_HOSTING_AUTHORITY');
  }
  if (manifest.rights?.disposition !== 'ALLOWED_SHARED_RAG') {
    fail('ROSSTAT_RIGHTS_DISPOSITION');
  }
  if (
    !manifest.rights?.attributionRequired
    || !manifest.rights?.noDistortionRequired
    || !manifest.rights?.sourceLinkRequired
  ) {
    fail('ROSSTAT_RIGHTS_OBLIGATIONS');
  }
  if (
    manifest.activation?.sharedRagAllowed
    || manifest.activation?.parserExecutionEnabled
    || manifest.activation?.postgresqlAdmissionEnabled
  ) {
    fail('ROSSTAT_PREMATURE_ACTIVATION');
  }
  if (!Array.isArray(manifest.resources) || manifest.resources.length !== REQUIRED_CODES.length) {
    fail('ROSSTAT_RESOURCE_COUNT');
  }
  const codes = manifest.resources.map(({ code }) => code).sort();
  if (JSON.stringify(codes) !== JSON.stringify([...REQUIRED_CODES].sort())) {
    fail('ROSSTAT_RESOURCE_CODES');
  }
  for (const resource of manifest.resources) {
    assertExactRoute(resource);
    if (
      !Number.isInteger(resource.maximumBytes)
      || resource.maximumBytes < 1
      || resource.maximumBytes > 20_000_000
    ) {
      fail('ROSSTAT_SIZE_POLICY', resource.code);
    }
    if (!Array.isArray(resource.allowedMediaTypes) || resource.allowedMediaTypes.length === 0) {
      fail('ROSSTAT_MEDIA_POLICY', resource.code);
    }
    if (resource.expectedSha256 !== null && !SHA256.test(resource.expectedSha256)) {
      fail('ROSSTAT_PIN_FORMAT', resource.code);
    }
    const expectedState = resource.expectedSha256 === null ? 'DISCOVERY_REQUIRED' : 'PINNED';
    if (resource.evidenceState !== expectedState) {
      fail('ROSSTAT_EVIDENCE_STATE', resource.code);
    }
    if (
      resource.code === 'SDMX_STRUCTURE_XML'
      && resource.observedContentProfile !== 'SDMX_2_0_STRUCTURE_XML'
    ) {
      fail('ROSSTAT_SDMX_PROFILE_MISSING');
    }
  }
}

function acquire(resource, ip, directory) {
  const bodyPath = resolve(directory, `${resource.code}.body`);
  const headerPath = resolve(directory, `${resource.code}.headers`);
  const result = spawnSync(
    'curl',
    [
      '--silent',
      '--show-error',
      '--fail-with-body',
      '--proto',
      '=https',
      '--tlsv1.2',
      '--max-redirs',
      '0',
      '--connect-timeout',
      '10',
      '--max-time',
      '90',
      '--max-filesize',
      String(resource.maximumBytes),
      '--header',
      'Accept-Encoding: identity',
      '--header',
      'Cookie:',
      '--user-agent',
      'Transparent-Agro-Intelligence/1.0 governed-open-data-acquisition',
      '--resolve',
      `${HOST}:443:${ip}`,
      '--dump-header',
      headerPath,
      '--output',
      bodyPath,
      '--write-out',
      '%{http_code}\n%{content_type}\n%{url_effective}\n',
      resource.uri,
    ],
    { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 },
  );
  if (result.error || result.status !== 0) {
    fail(
      'ROSSTAT_FETCH_FAILED',
      `${resource.code}:${result.status}:${result.stderr?.trim() ?? result.error?.message}`,
    );
  }

  const lines = result.stdout.trim().split('\n');
  if (lines.length < 3) fail('ROSSTAT_CURL_RESULT_INVALID', resource.code);
  const effectiveUri = lines.at(-1);
  const curlType = lines.at(-2)?.split(';', 1)[0].trim().toLowerCase();
  const curlStatus = Number(lines.at(-3));
  if (effectiveUri !== resource.uri) {
    fail('ROSSTAT_EFFECTIVE_URI_MISMATCH', resource.code);
  }

  const body = readFileSync(bodyPath);
  const parsed = parseHeaders(readFileSync(headerPath, 'utf8'));
  if (curlStatus !== 200 || parsed.status !== 200) {
    fail('ROSSTAT_HTTP_NOT_OK', resource.code);
  }
  if (body.length < 1 || body.length > resource.maximumBytes) {
    fail('ROSSTAT_BODY_SIZE', resource.code);
  }
  const mediaType = (parsed.headers['content-type'] ?? curlType ?? '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase();
  if (!resource.allowedMediaTypes.includes(mediaType)) {
    fail('ROSSTAT_MIME_MISMATCH', `${resource.code}:${mediaType}`);
  }

  assertBody(resource, body);
  const sha = digest(body);
  if (resource.expectedSha256 !== null && resource.expectedSha256 !== sha) {
    fail('ROSSTAT_DIGEST_MISMATCH', resource.code);
  }

  return {
    code: resource.code,
    requestedUri: resource.uri,
    finalUri: effectiveUri,
    resolvedIp: ip,
    tlsServerName: HOST,
    httpStatus: parsed.status,
    mediaType,
    sizeBytes: body.length,
    wireSha256: sha,
    decodedSha256: sha,
    responseHeadersSha256: headerDigest(parsed.headers),
    expectedSha256: resource.expectedSha256,
    digestMatched: resource.expectedSha256 === sha,
    observedContentProfile: resource.observedContentProfile ?? null,
  };
}

function buildEvidence({ dnsEvidence, resources, failure = null }) {
  const allDigestsPinned = (
    failure === null
    && resources.length === REQUIRED_CODES.length
    && resources.every(
      (resource) => resource.expectedSha256 !== null && resource.digestMatched,
    )
  );
  return {
    schemaVersion: 'tai.ap14f1c-rosstat-resource-evidence.v1',
    datasetCode: DATASET,
    sourceId: SOURCE_ID,
    exactHead: process.env.EXACT_HEAD ?? process.env.GITHUB_SHA ?? 'LOCAL_UNATTESTED',
    observedAt: new Date().toISOString(),
    operationalStatus: 'NOT_ATTESTED',
    productionHosting: 'REG_RU_VPS_ONLY',
    dns: dnsEvidence,
    resources,
    failure,
    rawBytesPersisted: false,
    allDigestsPinned,
    sharedRagAllowed: false,
  };
}

function selfTest() {
  const valid = {
    code: 'DATA_XML',
    uri: `https://${HOST}${BASE_PATH}/data.xml`,
    path: `${BASE_PATH}/data.xml`,
  };
  assertExactRoute(valid);
  const invalid = [
    { ...valid, uri: valid.uri.replace('https:', 'http:') },
    { ...valid, uri: valid.uri.replace(HOST, 'example.org') },
    { ...valid, uri: `${valid.uri}?x=1` },
    {
      ...valid,
      uri: `https://${HOST}${BASE_PATH}-escape/data.xml`,
      path: `${BASE_PATH}-escape/data.xml`,
    },
  ];
  for (const resource of invalid) {
    let rejected = false;
    try {
      assertExactRoute(resource);
    } catch {
      rejected = true;
    }
    if (!rejected) fail('ROSSTAT_SELF_TEST_ROUTE_ACCEPTED');
  }

  for (const ip of [
    '10.0.0.1',
    '127.0.0.1',
    '169.254.1.1',
    '172.16.0.1',
    '192.168.1.1',
    '198.51.100.1',
  ]) {
    if (isGlobalIpv4(ip)) fail('ROSSTAT_SELF_TEST_NON_GLOBAL_ACCEPTED', ip);
  }
  if (!isGlobalIpv4('8.8.8.8')) {
    fail('ROSSTAT_SELF_TEST_GLOBAL_REJECTED');
  }

  const sdmx = `<?xml version="1.0" encoding="UTF-8"?>
<Structure xmlns="${SDMX_MESSAGE_NS}"
  xmlns:common="${SDMX_COMMON_NS}"
  xmlns:structure="${SDMX_STRUCTURE_NS}">
  <Header><ID>7708234640-VSHP2016-254</ID></Header>
</Structure>`;
  assertBody(
    { code: 'SDMX_STRUCTURE_XML' },
    Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(sdmx)]),
  );
  assertBody(
    { code: 'SDMX_STRUCTURE_XML' },
    Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(sdmx, 'utf16le')]),
  );

  const fakeXsd = '<?xml version="1.0"?><xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"/>';
  let xsdRejected = false;
  try {
    assertBody({ code: 'SDMX_STRUCTURE_XML' }, Buffer.from(fakeXsd));
  } catch {
    xsdRejected = true;
  }
  if (!xsdRejected) fail('ROSSTAT_SELF_TEST_XSD_MISCLASSIFICATION_ACCEPTED');

  console.log('TAI AP-14F1C discovery self-test = success');
}

async function main() {
  if (process.argv.includes('--self-test')) return selfTest();

  const manifestFlag = process.argv.indexOf('--manifest');
  const outputFlag = process.argv.indexOf('--output');
  const manifestPath = manifestFlag >= 0 ? process.argv[manifestFlag + 1] : DEFAULT_MANIFEST;
  const outputPath = outputFlag >= 0 ? process.argv[outputFlag + 1] : DEFAULT_OUTPUT;
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  validateManifest(manifest);
  mkdirSync(dirname(outputPath), { recursive: true });

  const directory = mkdtempSync(resolve(tmpdir(), 'tai-ap14f1c-'));
  let dnsEvidence = null;
  const resources = [];
  try {
    dnsEvidence = await pinnedDns();
    for (const resource of manifest.resources) {
      try {
        resources.push(acquire(resource, dnsEvidence.selected, directory));
      } catch (error) {
        const failure = {
          resourceCode: resource.code,
          reasonCode: errorCode(error),
          detailSha256: digest(
            Buffer.from(error instanceof Error ? error.message : String(error)),
          ),
        };
        writeFileSync(
          outputPath,
          `${JSON.stringify(buildEvidence({ dnsEvidence, resources, failure }), null, 2)}\n`,
        );
        throw error;
      }
    }

    const evidence = buildEvidence({ dnsEvidence, resources });
    writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
    console.log(JSON.stringify({
      outputPath,
      resources: resources.map(
        ({ code, mediaType, sizeBytes, wireSha256, observedContentProfile }) => ({
          code,
          mediaType,
          sizeBytes,
          wireSha256,
          observedContentProfile,
        }),
      ),
    }, null, 2));
    if (!evidence.allDigestsPinned) process.exitCode = 42;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack : String(error));
    process.exitCode = 1;
  });
}

export {
  assertBody,
  assertExactRoute,
  decodeXmlText,
  isGlobalIpv4,
  parseHeaders,
  validateManifest,
};
