#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const DATASET_ROOT = 'https://opendata.mcx.ru/opendata/7708075454-zerno';
const ALLOWED_HOSTS = new Set(['opendata.mcx.ru']);
const MAX_DISCOVERY_BYTES = 4 * 1024 * 1024;
const MAX_SCHEMA_BYTES = 8 * 1024 * 1024;
const MAX_DATA_BYTES = 24 * 1024 * 1024;

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function decode(buffer) {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  return text.replace(/^\uFEFF/, '');
}

function normalizeOfficialUrl(raw) {
  const decoded = String(raw || '').replace(/&amp;/g, '&').trim();
  const url = new URL(decoded, `${DATASET_ROOT}/`);
  if (!ALLOWED_HOSTS.has(url.hostname)) throw new Error('FGIS_PROBE_HOST_NOT_ALLOWLISTED');
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('FGIS_PROBE_SCHEME_UNSUPPORTED');
  url.hash = '';
  return url;
}

function secureVariant(url) {
  const copy = new URL(url);
  copy.protocol = 'https:';
  return copy;
}

async function fetchBounded(initialUrl, maxBytes) {
  let current = normalizeOfficialUrl(initialUrl);
  for (let redirect = 0; redirect <= 3; redirect += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    let response;
    try {
      response = await fetch(current, {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'user-agent': 'pc-crop-role-eligibility-source-contract-probe/1.0',
          accept: 'text/html,application/xml,text/xml,text/csv,application/zip,application/octet-stream;q=0.8,*/*;q=0.1',
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('FGIS_PROBE_REDIRECT_WITHOUT_LOCATION');
      current = normalizeOfficialUrl(new URL(location, current).toString());
      continue;
    }
    if (!response.ok) throw new Error(`FGIS_PROBE_HTTP_${response.status}`);

    const reader = response.body?.getReader();
    if (!reader) throw new Error('FGIS_PROBE_BODY_MISSING');
    const chunks = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new Error('FGIS_PROBE_RESPONSE_TOO_LARGE');
      chunks.push(Buffer.from(value));
    }
    const body = Buffer.concat(chunks);
    return {
      requestedUrl: String(initialUrl),
      finalUrl: current.toString(),
      status: response.status,
      contentType: String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase(),
      contentLength: body.length,
      sha256: sha256(body),
      body,
    };
  }
  throw new Error('FGIS_PROBE_REDIRECT_LIMIT');
}

function extractOfficialLinks(text) {
  const found = new Set();
  const patterns = [
    /https?:\/\/opendata\.mcx\.ru\/opendata\/7708075454-zerno\/(?:data|structure)-[^"'<>\s]+/gi,
    /(?:href|src)=["']([^"']*(?:data|structure)-[^"']+)["']/gi,
    /<(?:data|structure|link|url)[^>]*>(https?:\/\/opendata\.mcx\.ru\/opendata\/7708075454-zerno\/[^<\s]+)<\//gi,
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const raw = match[1] || match[0];
      try {
        const url = normalizeOfficialUrl(raw);
        if (!url.pathname.startsWith('/opendata/7708075454-zerno/')) continue;
        if (!/(?:\/data-|\/structure-)/.test(url.pathname)) continue;
        found.add(url.toString());
      } catch {
        // Ignore non-authority links; the probe itself remains bounded to the official host.
      }
    }
  }
  return [...found].sort();
}

function inspectXmlSchema(text) {
  const root = text.match(/<\?xml[^>]*>\s*<([A-Za-z_][\w:.-]*)\b/i)?.[1]
    || text.match(/<([A-Za-z_][\w:.-]*)\b/i)?.[1]
    || null;
  const tagNames = [...new Set([...text.matchAll(/<\/?([A-Za-z_][\w:.-]*)\b/g)].map((m) => m[1]))].sort();
  const declaredNames = [...new Set([
    ...[...text.matchAll(/<(?:xs:|xsd:)?element\b[^>]*\bname=["']([^"']+)["']/gi)].map((m) => m[1]),
    ...[...text.matchAll(/<(?:xs:|xsd:)?attribute\b[^>]*\bname=["']([^"']+)["']/gi)].map((m) => m[1]),
  ])].sort();
  return {
    rootTag: root,
    tagNames: tagNames.slice(0, 200),
    declaredNames: declaredNames.slice(0, 300),
  };
}

function inspectCsvHeader(text) {
  const first = String(text.split(/\r?\n/, 1)[0] || '').trim();
  if (!first) return [];
  const delimiter = first.includes(';') ? ';' : ',';
  return first.split(delimiter).map((value) => value.replace(/^"|"$/g, '').trim()).filter(Boolean).slice(0, 100);
}

const output = {
  schemaVersion: 'role-eligibility-fgis-source-contract-probe.v1',
  source: 'FGIS_GRAIN',
  authorityRoot: DATASET_ROOT,
  mode: 'READ_ONLY_EXTERNAL_OBSERVATION',
  productionDatabaseMutation: 0,
  registrationTouched: false,
  probes: [],
  discoveredLinks: [],
  data: null,
  structure: null,
};

try {
  const discoveryUrls = [DATASET_ROOT, `${DATASET_ROOT}/meta.xml`];
  const discovered = new Set();
  for (const url of discoveryUrls) {
    try {
      const probe = await fetchBounded(url, MAX_DISCOVERY_BYTES);
      const text = decode(probe.body);
      for (const link of extractOfficialLinks(text)) discovered.add(link);
      output.probes.push({
        requestedUrl: probe.requestedUrl,
        finalUrl: probe.finalUrl,
        status: probe.status,
        contentType: probe.contentType,
        contentLength: probe.contentLength,
        sha256: probe.sha256,
      });
    } catch (error) {
      output.probes.push({ requestedUrl: url, errorCode: error instanceof Error ? error.message : 'FGIS_PROBE_UNKNOWN' });
    }
  }

  output.discoveredLinks = [...discovered].map((raw) => {
    const url = normalizeOfficialUrl(raw);
    return {
      publishedUrl: url.toString(),
      secureUrl: secureVariant(url).toString(),
      kind: url.pathname.includes('/structure-') ? 'STRUCTURE' : 'DATA',
    };
  });

  const dataCandidate = output.discoveredLinks.find((entry) => entry.kind === 'DATA');
  const structureCandidate = output.discoveredLinks.find((entry) => entry.kind === 'STRUCTURE');

  if (structureCandidate) {
    try {
      const probe = await fetchBounded(structureCandidate.secureUrl, MAX_SCHEMA_BYTES);
      const text = decode(probe.body);
      output.structure = {
        finalUrl: probe.finalUrl,
        contentType: probe.contentType,
        contentLength: probe.contentLength,
        sha256: probe.sha256,
        xmlSchema: inspectXmlSchema(text),
      };
    } catch (error) {
      output.structure = { errorCode: error instanceof Error ? error.message : 'FGIS_PROBE_STRUCTURE_UNKNOWN' };
    }
  }

  if (dataCandidate) {
    try {
      const probe = await fetchBounded(dataCandidate.secureUrl, MAX_DATA_BYTES);
      const magic = probe.body.subarray(0, 8).toString('hex');
      const text = /xml|csv|text/.test(probe.contentType) ? decode(probe.body) : '';
      output.data = {
        finalUrl: probe.finalUrl,
        contentType: probe.contentType,
        contentLength: probe.contentLength,
        sha256: probe.sha256,
        magic,
        xmlShape: text && (probe.contentType.includes('xml') || /^\s*<\?xml|^\s*</.test(text)) ? inspectXmlSchema(text) : null,
        csvHeader: text && (probe.contentType.includes('csv') || /[,;]/.test(text.split(/\r?\n/, 1)[0] || '')) ? inspectCsvHeader(text) : [],
      };
      writeFileSync('fgis-dataset-sample.bin', probe.body);
    } catch (error) {
      output.data = { errorCode: error instanceof Error ? error.message : 'FGIS_PROBE_DATA_UNKNOWN' };
    }
  }

  if (!dataCandidate) output.data = { errorCode: 'FGIS_PROBE_DATA_LINK_NOT_DISCOVERED' };
  if (!structureCandidate) output.structure = { errorCode: 'FGIS_PROBE_STRUCTURE_LINK_NOT_DISCOVERED' };
} catch (error) {
  output.fatalErrorCode = error instanceof Error ? error.message : 'FGIS_PROBE_FATAL_UNKNOWN';
}

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
