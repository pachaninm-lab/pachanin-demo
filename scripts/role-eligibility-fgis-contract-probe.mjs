#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const DATASET_PATH = '/opendata/7708075454-zerno';
const HTTPS_ROOT = `https://opendata.mcx.ru${DATASET_PATH}`;
const HTTP_ROOT = `http://opendata.mcx.ru${DATASET_PATH}`;
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

function errorInfo(error, fallback = 'FGIS_PROBE_UNKNOWN') {
  const cause = error && typeof error === 'object' ? error.cause : null;
  return {
    errorCode: error instanceof Error ? error.message : fallback,
    errorName: error instanceof Error ? error.name : null,
    causeCode: cause && typeof cause === 'object' ? String(cause.code || '') || null : null,
    causeMessage: cause && typeof cause === 'object' ? String(cause.message || '') || null : null,
    causeErrno: cause && typeof cause === 'object' && cause.errno != null ? String(cause.errno) : null,
    causeSyscall: cause && typeof cause === 'object' ? String(cause.syscall || '') || null : null,
    causeHostname: cause && typeof cause === 'object' ? String(cause.hostname || '') || null : null,
  };
}

function normalizeOfficialUrl(raw) {
  const decoded = String(raw || '').replace(/&amp;/g, '&').trim();
  const url = new URL(decoded, `${HTTPS_ROOT}/`);
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
          'user-agent': 'pc-crop-role-eligibility-source-contract-probe/2.0',
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
      transport: current.protocol === 'https:' ? 'HTTPS' : 'HTTP',
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
        if (!url.pathname.startsWith(`${DATASET_PATH}/`)) continue;
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

async function firstSuccessful(candidates, maxBytes) {
  const attempts = [];
  for (const candidate of candidates) {
    try {
      const probe = await fetchBounded(candidate, maxBytes);
      attempts.push({ url: candidate, status: probe.status, transport: probe.transport, finalUrl: probe.finalUrl });
      return { probe, attempts };
    } catch (error) {
      attempts.push({ url: candidate, ...errorInfo(error) });
    }
  }
  return { probe: null, attempts };
}

const output = {
  schemaVersion: 'role-eligibility-fgis-source-contract-probe.v2',
  source: 'FGIS_GRAIN',
  authorityRoot: HTTPS_ROOT,
  mode: 'READ_ONLY_EXTERNAL_OBSERVATION',
  productionDatabaseMutation: 0,
  registrationTouched: false,
  probes: [],
  discoveredLinks: [],
  data: null,
  structure: null,
  contractStatus: 'UNRESOLVED',
  productionTransportEligible: false,
};

try {
  const discoveryUrls = [HTTPS_ROOT, HTTP_ROOT, `${HTTPS_ROOT}/meta.xml`, `${HTTP_ROOT}/meta.xml`];
  const discovered = new Set();
  for (const url of discoveryUrls) {
    try {
      const probe = await fetchBounded(url, MAX_DISCOVERY_BYTES);
      const text = decode(probe.body);
      for (const link of extractOfficialLinks(text)) discovered.add(link);
      output.probes.push({
        requestedUrl: probe.requestedUrl,
        finalUrl: probe.finalUrl,
        transport: probe.transport,
        status: probe.status,
        contentType: probe.contentType,
        contentLength: probe.contentLength,
        sha256: probe.sha256,
      });
    } catch (error) {
      output.probes.push({ requestedUrl: url, ...errorInfo(error) });
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
    const { probe, attempts } = await firstSuccessful(
      [...new Set([structureCandidate.secureUrl, structureCandidate.publishedUrl])],
      MAX_SCHEMA_BYTES,
    );
    if (probe) {
      const text = decode(probe.body);
      output.structure = {
        finalUrl: probe.finalUrl,
        transport: probe.transport,
        contentType: probe.contentType,
        contentLength: probe.contentLength,
        sha256: probe.sha256,
        xmlSchema: inspectXmlSchema(text),
        attempts,
      };
    } else {
      output.structure = { errorCode: 'FGIS_PROBE_STRUCTURE_FETCH_FAILED', attempts };
    }
  } else {
    output.structure = { errorCode: 'FGIS_PROBE_STRUCTURE_LINK_NOT_DISCOVERED' };
  }

  if (dataCandidate) {
    const { probe, attempts } = await firstSuccessful(
      [...new Set([dataCandidate.secureUrl, dataCandidate.publishedUrl])],
      MAX_DATA_BYTES,
    );
    if (probe) {
      const magic = probe.body.subarray(0, 8).toString('hex');
      const text = /xml|csv|text/.test(probe.contentType) ? decode(probe.body) : '';
      output.data = {
        finalUrl: probe.finalUrl,
        transport: probe.transport,
        contentType: probe.contentType,
        contentLength: probe.contentLength,
        sha256: probe.sha256,
        magic,
        xmlShape: text && (probe.contentType.includes('xml') || /^\s*<\?xml|^\s*</.test(text)) ? inspectXmlSchema(text) : null,
        csvHeader: text && (probe.contentType.includes('csv') || /[,;]/.test(text.split(/\r?\n/, 1)[0] || '')) ? inspectCsvHeader(text) : [],
        attempts,
      };
      writeFileSync('fgis-dataset-sample.bin', probe.body);
    } else {
      output.data = { errorCode: 'FGIS_PROBE_DATA_FETCH_FAILED', attempts };
    }
  } else {
    output.data = { errorCode: 'FGIS_PROBE_DATA_LINK_NOT_DISCOVERED' };
  }

  const dataHttps = output.data?.transport === 'HTTPS';
  const structureHttps = output.structure?.transport === 'HTTPS';
  const dataObserved = Boolean(output.data?.transport);
  const structureObserved = Boolean(output.structure?.transport);
  if (dataHttps && structureHttps) {
    output.contractStatus = 'PROVEN_HTTPS_TRANSPORT_SHAPE_OBSERVED';
    output.productionTransportEligible = true;
  } else if (dataObserved && structureObserved) {
    output.contractStatus = 'OBSERVED_BUT_INSECURE_TRANSPORT';
  } else if (output.probes.some((probe) => probe.status)) {
    output.contractStatus = 'PASSPORT_REACHABLE_DATA_CONTRACT_UNRESOLVED';
  } else {
    output.contractStatus = 'OFFICIAL_HOST_UNREACHABLE_FROM_RUNNER';
  }
} catch (error) {
  output.fatalError = errorInfo(error, 'FGIS_PROBE_FATAL_UNKNOWN');
  output.contractStatus = 'PROBE_FATAL';
}

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
