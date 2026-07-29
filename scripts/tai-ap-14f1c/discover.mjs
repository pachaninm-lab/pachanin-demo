#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promises as dns } from 'node:dns';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOST = 'rosstat.gov.ru';
const DATASET_CODE = '7708234640-VSHP2016254';
const MANIFEST_PATH = 'apps/tai/knowledge-sources/AP-14F1C-ROSSTAT-7708234640-VSHP2016254.v1.json';
const DEFAULT_OUTPUT = 'artifacts/tai-ap-14f1c/rosstat-resource-evidence.json';
const EXACT_CODES = Object.freeze(['DATASET_PAGE', 'PASSPORT_CSV', 'STRUCTURE_XSD', 'DATA_XML']);
const SHA256 = /^[0-9a-f]{64}$/;

function fail(code, detail = '') {
  const suffix = detail ? `: ${detail}` : '';
  throw new Error(`${code}${suffix}`);
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function assertExactUri(resource) {
  const parsed = new URL(resource.uri);
  if (parsed.protocol !== 'https:') fail('ROSSTAT_HTTPS_REQUIRED', resource.code);
  if (parsed.hostname !== HOST || parsed.port !== '') fail('ROSSTAT_HOST_PIN_MISMATCH', resource.code);
  if (parsed.username || parsed.password || parsed.hash || parsed.search) {
    fail('ROSSTAT_URI_CREDENTIAL_QUERY_OR_FRAGMENT', resource.code);
  }
  if (parsed.pathname !== resource.path) fail('ROSSTAT_PATH_PIN_MISMATCH', resource.code);
  if (!parsed.pathname.startsWith(`/opendata/${DATASET_CODE}`)) {
    fail('ROSSTAT_DATASET_ROUTE_ESCAPE', resource.code);
  }
  return parsed;
}

function isGlobalIpv4(address) {
  const parts = address.split('.').map((value) => Number(value));
  if (parts.length !== 4 || parts.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
    return false;
  }
  const [a, b, c] = parts;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 0 && c === 0) return false;
  if (a === 192 && b === 0 && c === 2) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

async function resolvePinnedAddress(hostname) {
  const addresses = [...new Set(await dns.resolve4(hostname))].sort((left, right) => {
    const leftParts = left.split('.').map(Number);
    const rightParts = right.split('.').map(Number);
    for (let index = 0; index < 4; index += 1) {
      if (leftParts[index] !== rightParts[index]) return leftParts[index] - rightParts[index];
    }
    return 0;
  });
  if (addresses.length === 0) fail('ROSSTAT_DNS_EMPTY');
  const nonGlobal = addresses.filter((address) => !isGlobalIpv4(address));
  if (nonGlobal.length > 0) fail('ROSSTAT_DNS_NON_GLOBAL', nonGlobal.join(','));
  return { selected: addresses[0], observed: addresses };
}

function parseHeaderBlocks(rawHeaders) {
  const normalized = rawHeaders.replaceAll('\r\n', '\n');
  const blocks = normalized.split(/\n\n+/).filter((block) => block.trim().startsWith('HTTP/'));
  if (blocks.length !== 1) fail('ROSSTAT_REDIRECT_OR_PROXY_HEADER_CHAIN', String(blocks.length));
  const lines = blocks[0].split('\n').filter(Boolean);
  const statusLine = lines.shift() ?? '';
  const statusMatch = statusLine.match(/^HTTP\/\S+\s+(\d{3})\b/);
  if (!statusMatch) fail('ROSSTAT_HTTP_STATUS_INVALID');
  const headers = {};
  for (const line of lines) {
    const separator = line.indexOf(':');
    if (separator <= 0) fail('ROSSTAT_RESPONSE_HEADER_INVALID', line);
    const name = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim().replace(/\s+/g, ' ');
    if (!name || value.includes('\r') || value.includes('\n')) fail('ROSSTAT_RESPONSE_HEADER_INVALID', name);
    headers[name] = headers[name] ? `${headers[name]}, ${value}` : value;
  }
  return { status: Number(statusMatch[1]), headers };
}

function canonicalHeaderDigest(headers) {
  const lines = Object.entries(headers)
    .map(([name, value]) => `${name.trim().toLowerCase()}:${String(value).trim().replace(/\s+/g, ' ')}`)
    .sort();
  return sha256(Buffer.from(lines.join('\n'), 'utf8'));
}

function mediaTypeOf(headers, curlContentType) {
  const raw = headers['content-type'] ?? curlContentType ?? '';
  return raw.split(';', 1)[0].trim().toLowerCase();
}

function assertBodyShape(resource, body) {
  const trimmed = body.subarray(0, Math.min(body.length, 512)).toString('latin1').trimStart().toLowerCase();
  if (resource.code === 'DATASET_PAGE') {
    const text = body.toString('utf8');
    for (const marker of [DATASET_CODE, 'meta.csv', 'structure-20181211T0212.xsd', 'data-20181211T0212-structure-20181211T0212.xml']) {
      if (!text.includes(marker)) fail('ROSSTAT_DATASET_PAGE_MARKER_MISSING', marker);
    }
    return;
  }
  if (resource.code === 'PASSPORT_CSV') {
    if (trimmed.startsWith('<!doctype html') || trimmed.startsWith('<html')) fail('ROSSTAT_PASSPORT_HTML_MISMATCH');
    const ascii = body.toString('latin1');
    for (const marker of [DATASET_CODE, 'structure-20181211T0212.xsd', 'data-20181211T0212-structure-20181211T0212.xml']) {
      if (!ascii.includes(marker)) fail('ROSSTAT_PASSPORT_MARKER_MISSING', marker);
    }
    return;
  }
  if (!trimmed.startsWith('<?xml') && !trimmed.startsWith('<')) {
    fail('ROSSTAT_XML_SIGNATURE_MISMATCH', resource.code);
  }
  const lower = body.toString('latin1').toLowerCase();
  if (lower.includes('<!doctype') || lower.includes('<!entity') || lower.includes('<xi:include')) {
    fail('ROSSTAT_XML_ACTIVE_REFERENCE_FORBIDDEN', resource.code);
  }
  if (resource.code === 'STRUCTURE_XSD') {
    if (!lower.includes('schema') || !lower.includes('http://www.w3.org/2001/xmlschema')) {
      fail('ROSSTAT_XSD_SCHEMA_MARKER_MISSING');
    }
    if (/<(?:xs|xsd):(include|import|redefine)\b/i.test(lower)) {
      fail('ROSSTAT_XSD_EXTERNAL_COMPOSITION_FORBIDDEN');
    }
  }
}

function assertManifest(manifest) {
  if (manifest.schemaVersion !== 'tai.ap14f1c-rosstat-dataset.v1') fail('ROSSTAT_MANIFEST_SCHEMA_VERSION');
  if (manifest.datasetCode !== DATASET_CODE) fail('ROSSTAT_MANIFEST_DATASET_CODE');
  if (manifest.sourceId !== 'official.rosstat.opendata.7708234640-vshp2016254') fail('ROSSTAT_MANIFEST_SOURCE_ID');
  if (manifest.operationalStatus !== 'NOT_ATTESTED' || manifest.productionHosting !== 'REG_RU_VPS_ONLY') {
    fail('ROSSTAT_MANIFEST_STATUS_BOUNDARY');
  }
  if (manifest.rights?.disposition !== 'ALLOWED_SHARED_RAG') fail('ROSSTAT_RIGHTS_DISPOSITION');
  if (!manifest.rights?.attributionRequired || !manifest.rights?.noDistortionRequired || !manifest.rights?.sourceLinkRequired) {
    fail('ROSSTAT_RIGHTS_OBLIGATIONS_MISSING');
  }
  if (manifest.activation?.sharedRagAllowed || manifest.activation?.parserExecutionEnabled || manifest.activation?.postgresqlAdmissionEnabled) {
    fail('ROSSTAT_PREMATURE_ACTIVATION');
  }
  if (!Array.isArray(manifest.resources) || manifest.resources.length !== EXACT_CODES.length) {
    fail('ROSSTAT_RESOURCE_COUNT');
  }
  const codes = manifest.resources.map((resource) => resource.code);
  if (canonicalJson(codes.slice().sort()) !== canonicalJson(EXACT_CODES.slice().sort())) fail('ROSSTAT_RESOURCE_CODES');
  for (const resource of manifest.resources) {
    assertExactUri(resource);
    if (!Array.isArray(resource.allowedMediaTypes) || resource.allowedMediaTypes.length === 0) fail('ROSSTAT_MEDIA_POLICY_EMPTY', resource.code);
    if (!Number.isInteger(resource.maximumBytes) || resource.maximumBytes < 1 || resource.maximumBytes > 20_000_000) {
      fail('ROSSTAT_SIZE_POLICY_INVALID', resource.code);
    }
    if (resource.expectedSha256 !== null && !SHA256.test(resource.expectedSha256)) fail('ROSSTAT_EXPECTED_SHA256_INVALID', resource.code);
    const expectedState = resource.expectedSha256 === null ? 'DISCOVERY_REQUIRED' : 'PINNED';
    if (resource.evidenceState !== expectedState) fail('ROSSTAT_EVIDENCE_STATE_MISMATCH', resource.code);
  }
}

function fetchResource(resource, pinnedAddress, workDir) {
  const bodyPath = resolve(workDir, `${resource.code}.body`);
  const headersPath = resolve(workDir, `${resource.code}.headers`);
  const result = spawnSync('curl', [
    '--silent',
    '--show-error',
    '--fail-with-body',
    '--proto', '=https',
    '--tlsv1.2',
    '--max-redirs', '0',
    '--connect-timeout', '10',
    '--max-time', '90',
    '--max-filesize', String(resource.maximumBytes),
    '--header', 'Accept-Encoding: identity',
    '--header', 'Cookie:',
    '--user-agent', 'Transparent-Agro-Intelligence/1.0 governed-open-data-acquisition',
    '--resolve', `${HOST}:443:${pinnedAddress}`,
    '--dump-header', headersPath,
    '--output', bodyPath,
    '--write-out', '%{http_code}\n%{content_type}\n%{url_effective}\n',
    resource.uri,
  ], { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 });
  if (result.error) fail('ROSSTAT_CURL_EXECUTION_FAILED', result.error.message);
  if (result.status !== 0) fail('ROSSTAT_FETCH_FAILED', `${resource.code}:${result.status}:${result.stderr.trim()}`);

  const writeOutLines = result.stdout.trim().split('\n');
  if (writeOutLines.length < 3) fail('ROSSTAT_CURL_WRITE_OUT_INVALID', resource.code);
  const effectiveUri = writeOutLines.at(-1);
  const curlContentType = writeOutLines.at(-2);
  const curlStatus = Number(writeOutLines.at(-3));
  if (effectiveUri !== resource.uri) fail('ROSSTAT_EFFECTIVE_URI_MISMATCH', `${resource.code}:${effectiveUri}`);

  const body = readFileSync(bodyPath);
  const rawHeaders = readFileSync(headersPath, 'utf8');
  const parsed = parseHeaderBlocks(rawHeaders);
  if (parsed.status !== 200 || curlStatus !== 200) fail('ROSSTAT_HTTP_NOT_OK', `${resource.code}:${parsed.status}:${curlStatus}`);
  if (body.length < 1 || body.length > resource.maximumBytes) fail('ROSSTAT_BODY_SIZE_POLICY', `${resource.code}:${body.length}`);
  const mediaType = mediaTypeOf(parsed.headers, curlContentType);
  if (!resource.allowedMediaTypes.includes(mediaType)) fail('ROSSTAT_MIME_POLICY', `${resource.code}:${mediaType}`);
  assertBodyShape(resource, body);

  const digest = sha256(body);
  if (resource.expectedSha256 !== null && resource.expectedSha256 !== digest) {
    fail('ROSSTAT_PINNED_DIGEST_MISMATCH', resource.code);
  }
  return {
    code: resource.code,
    requestedUri: resource.uri,
    finalUri: effectiveUri,
    resolvedIp: pinnedAddress,
    tlsServerName: HOST,
    httpStatus: parsed.status,
    mediaType,
    sizeBytes: body.length,
    wireSha256: digest,
    decodedSha256: digest,
    responseHeadersSha256: canonicalHeaderDigest(parsed.headers),
    expectedSha256: resource.expectedSha256,
    digestMatched: resource.expectedSha256 === digest,
  };
}

function writeEvidence(outputPath, manifest, dnsEvidence, resources, exactHead) {
  const payload = {
    schemaVersion: 'tai.ap14f1c-rosstat-resource-evidence.v1',
    datasetCode: DATASET_CODE,
    sourceId: manifest.sourceId,
    exactHead,
    observedAt: new Date().toISOString(),
    operationalStatus: 'NOT_ATTESTED',
    productionHosting: 'REG_RU_VPS_ONLY',
    dns: dnsEvidence,
    resources,
    rawBytesPersisted: false,
    allDigestsPinned: resources.every((resource) => resource.expectedSha256 !== null && resource.digestMatched),
    sharedRagAllowed: false,
  };
  writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return payload;
}

function selfTest() {
  const valid = {
    code: 'DATA_XML',
    uri: `https://${HOST}/opendata/${DATASET_CODE}/data-20181211T0212-structure-20181211T0212.xml`,
    path: `/opendata/${DATASET_CODE}/data-20181211T0212-structure-20181211T0212.xml`,
  };
  assertExactUri(valid);
  const rejected = [
    { ...valid, uri: valid.uri.replace('https:', 'http:') },
    { ...valid, uri: valid.uri.replace(HOST, 'example.org') },
    { ...valid, uri: `${valid.uri}?download=1` },
    { ...valid, uri: `https://${HOST}/opendata/${DATASET_CODE}-escape/data.xml`, path: `/opendata/${DATASET_CODE}-escape/data.xml` },
  ];
  for (const resource of rejected) {
    let failed = false;
    try {
      assertExactUri(resource);
    } catch {
      failed = true;
    }
    if (!failed) fail('ROSSTAT_SELF_TEST_ROUTE_ACCEPTED');
  }
  for (const address of ['10.0.0.1', '127.0.0.1', '169.254.1.1', '172.16.0.1', '192.168.1.1', '198.51.100.1']) {
    if (isGlobalIpv4(address)) fail('ROSSTAT_SELF_TEST_PRIVATE_IP_ACCEPTED', address);
  }
  if (!isGlobalIpv4('8.8.8.8')) fail('ROSSTAT_SELF_TEST_GLOBAL_IP_REJECTED');
  console.log('TAI AP-14F1C discovery self-test = success');
}

async function main() {
  const args = new Set(process.argv.slice(2));
  if (args.has('--self-test')) {
    selfTest();
    return;
  }
  const manifestIndex = process.argv.indexOf('--manifest');
  const outputIndex = process.argv.indexOf('--output');
  const manifestPath = manifestIndex >= 0 ? process.argv[manifestIndex + 1] : MANIFEST_PATH;
  const outputPath = outputIndex >= 0 ? process.argv[outputIndex + 1] : DEFAULT_OUTPUT;
  const exactHead = process.env.EXACT_HEAD ?? process.env.GITHUB_SHA ?? 'LOCAL_UNATTESTED';
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  assertManifest(manifest);

  const outputDir = dirname(outputPath);
  const { mkdirSync } = await import('node:fs');
  mkdirSync(outputDir, { recursive: true });
  const workDir = mkdtempSync(resolve(tmpdir(), 'tai-ap14f1c-'));
  try {
    const dnsEvidence = await resolvePinnedAddress(HOST);
    const evidence = [];
    for (const resource of manifest.resources) {
      evidence.push(fetchResource(resource, dnsEvidence.selected, workDir));
    }
    const payload = writeEvidence(outputPath, manifest, dnsEvidence, evidence, exactHead);
    console.log(JSON.stringify({ outputPath, allDigestsPinned: payload.allDigestsPinned, resources: evidence.map(({ code, sizeBytes, mediaType, wireSha256 }) => ({ code, sizeBytes, mediaType, wireSha256 })) }, null, 2));
    if (!payload.allDigestsPinned) {
      console.error('TAI AP-14F1C resource discovery completed; pin all observed SHA-256 values before admission.');
      process.exitCode = 42;
    }
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack : String(error));
    process.exitCode = 1;
  });
}

export { assertExactUri, assertManifest, isGlobalIpv4, parseHeaderBlocks };
