#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const MODE = process.argv[2] || 'fgis';
const DATASET_PATH = '/opendata/7708075454-zerno';
const HTTPS_ROOT = `https://opendata.mcx.ru${DATASET_PATH}`;
const HTTP_ROOT = `http://opendata.mcx.ru${DATASET_PATH}`;
const ALLOWED_HOSTS = new Set(['opendata.mcx.ru']);
const MAX_DISCOVERY_BYTES = 4 * 1024 * 1024;
const MAX_SCHEMA_BYTES = 8 * 1024 * 1024;
const MAX_DATA_BYTES = 24 * 1024 * 1024;

const FNS_RSMP_PASSPORT = 'https://www.nalog.gov.ru/opendata/7707329152-rsmp/';
const EAEU_LAB_REGISTER = 'https://tech.eaeunion.org/tech/ru/registers/36';

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function decode(buffer) {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  return text.replace(/^\uFEFF/, '');
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;|&#160;/gi, ' ');
}

function visibleText(html) {
  return decodeEntities(String(html || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function errorInfo(error, fallback = 'SOURCE_PROBE_UNKNOWN') {
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

function officialHostPredicate(kind) {
  if (kind === 'FNS') return (hostname) => hostname === 'www.nalog.gov.ru' || hostname === 'nalog.gov.ru' || hostname === 'file.nalog.ru';
  if (kind === 'EAEU') return (hostname) => hostname === 'eaeunion.org' || hostname.endsWith('.eaeunion.org');
  throw new Error('OFFICIAL_HOST_KIND_UNSUPPORTED');
}

async function fetchOfficialBounded(initialUrl, { kind, maxBytes, method = 'GET', headers = {} }) {
  const allowed = officialHostPredicate(kind);
  let current = new URL(initialUrl);
  for (let redirect = 0; redirect <= 3; redirect += 1) {
    if (current.protocol !== 'https:') throw new Error(`${kind}_HTTPS_REQUIRED`);
    if (!allowed(current.hostname)) throw new Error(`${kind}_HOST_NOT_ALLOWLISTED`);
    current.hash = '';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    let response;
    try {
      response = await fetch(current, {
        method,
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'user-agent': 'pc-crop-role-eligibility-official-source-contract-probe/1.0',
          accept: 'text/html,application/json,application/xml,text/xml,text/csv,application/zip,application/octet-stream;q=0.8,*/*;q=0.1',
          ...headers,
        },
      });
    } finally {
      clearTimeout(timeout);
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error(`${kind}_REDIRECT_WITHOUT_LOCATION`);
      current = new URL(location, current);
      continue;
    }
    if (!response.ok) throw new Error(`${kind}_HTTP_${response.status}`);
    if (method === 'HEAD') {
      return {
        requestedUrl: String(initialUrl),
        finalUrl: current.toString(),
        status: response.status,
        contentType: String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase(),
        contentLengthHeader: response.headers.get('content-length'),
        etag: response.headers.get('etag'),
        lastModified: response.headers.get('last-modified'),
      };
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error(`${kind}_BODY_MISSING`);
    const chunks = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        try { await reader.cancel(); } catch {}
        throw new Error(`${kind}_RESPONSE_TOO_LARGE`);
      }
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
  throw new Error(`${kind}_REDIRECT_LIMIT`);
}

function extractAnchors(html, baseUrl, kind) {
  const allowed = officialHostPredicate(kind);
  const anchors = [];
  for (const match of String(html || '').matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try {
      const url = new URL(decodeEntities(match[1]).trim(), baseUrl);
      if (url.protocol !== 'https:' || !allowed(url.hostname)) continue;
      url.hash = '';
      anchors.push({ url: url.toString(), text: visibleText(match[2]) });
    } catch {
      // Discovery is limited to parseable official HTTPS anchors.
    }
  }
  return anchors;
}

function inspectXmlSchema(text) {
  const root = text.match(/<\?xml[^>]*>\s*<([A-Za-z_А-Яа-яЁё][\w:.-]*)\b/i)?.[1]
    || text.match(/<([A-Za-z_А-Яа-яЁё][\w:.-]*)\b/i)?.[1]
    || null;
  const tagNames = [...new Set([...text.matchAll(/<\/?([A-Za-z_А-Яа-яЁё][\w:.-]*)\b/g)].map((m) => m[1]))].sort();
  const declaredNames = [...new Set([
    ...[...text.matchAll(/<(?:xs:|xsd:)?element\b[^>]*\bname=["']([^"']+)["']/gi)].map((m) => m[1]),
    ...[...text.matchAll(/<(?:xs:|xsd:)?attribute\b[^>]*\bname=["']([^"']+)["']/gi)].map((m) => m[1]),
  ])].sort();
  return {
    rootTag: root,
    tagNames: tagNames.slice(0, 200),
    declaredNames: declaredNames.slice(0, 500),
  };
}

function inspectCsvHeader(text) {
  const first = String(text.split(/\r?\n/, 1)[0] || '').trim();
  if (!first) return [];
  const delimiter = first.includes(';') ? ';' : ',';
  return first.split(delimiter).map((value) => value.replace(/^"|"$/g, '').trim()).filter(Boolean).slice(0, 100);
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

async function probeFnsRsmp() {
  const output = {
    schemaVersion: 'role-eligibility-fns-rsmp-source-contract-probe.v1',
    source: 'FNS_RSMP',
    authorityRoot: FNS_RSMP_PASSPORT,
    legalSemantics: 'OFFICIAL_OPEN_DATA_POSITIVE_MEMBERSHIP_ONLY',
    absenceSemantics: 'ABSENCE_IS_NOT_NEGATIVE_LEGAL_ENTITY_EVIDENCE',
    automaticNegativeAuthority: false,
    mode: 'READ_ONLY_EXTERNAL_OBSERVATION',
    productionDatabaseMutation: 0,
    registrationTouched: false,
    passport: null,
    structure: null,
    data: null,
    contractStatus: 'UNRESOLVED',
    productionTransportEligible: false,
  };
  try {
    const passport = await fetchOfficialBounded(FNS_RSMP_PASSPORT, { kind: 'FNS', maxBytes: 2 * 1024 * 1024 });
    const html = decode(passport.body);
    const text = visibleText(html);
    const anchors = extractAnchors(html, passport.finalUrl, 'FNS');
    const data = anchors.find((entry) => /file\.nalog\.ru\/opendata\/7707329152-rsmp\/data-[^/?#]+\.zip$/i.test(entry.url));
    const structure = anchors.find((entry) => /file\.nalog\.ru\/opendata\/7707329152-rsmp\/structure-[^/?#]+\.xsd$/i.test(entry.url));
    output.passport = {
      finalUrl: passport.finalUrl,
      status: passport.status,
      contentType: passport.contentType,
      sha256: passport.sha256,
      declaresXml: /Формат\s+данных\s+xml/i.test(text),
      declaresOpenDataset: /Единый\s+реестр\s+субъектов\s+малого\s+и\s+среднего\s+предпринимательства/i.test(text),
      dataUrl: data?.url || null,
      structureUrl: structure?.url || null,
    };
    if (!data || !structure) {
      output.contractStatus = 'OFFICIAL_PASSPORT_REACHABLE_LINKS_UNRESOLVED';
      return output;
    }
    const structureProbe = await fetchOfficialBounded(structure.url, { kind: 'FNS', maxBytes: 4 * 1024 * 1024 });
    const xsd = decode(structureProbe.body);
    const xmlSchema = inspectXmlSchema(xsd);
    const names = xmlSchema.declaredNames.join(' ');
    output.structure = {
      finalUrl: structureProbe.finalUrl,
      status: structureProbe.status,
      contentType: structureProbe.contentType,
      contentLength: structureProbe.contentLength,
      sha256: structureProbe.sha256,
      xmlSchema,
      identityShapeObserved: /ИНН/i.test(names) && /ОГРН/i.test(names),
      activityShapeObserved: /ОКВЭД|ВидДеят/i.test(names),
    };
    const dataHead = await fetchOfficialBounded(data.url, { kind: 'FNS', maxBytes: 0, method: 'HEAD' });
    output.data = {
      finalUrl: dataHead.finalUrl,
      status: dataHead.status,
      contentType: dataHead.contentType,
      contentLengthHeader: dataHead.contentLengthHeader,
      etag: dataHead.etag,
      lastModified: dataHead.lastModified,
    };
    const legalShape = output.passport.declaresXml && output.passport.declaresOpenDataset;
    const machineShape = output.structure.identityShapeObserved === true;
    if (legalShape && machineShape && output.data.status >= 200 && output.data.status < 300) {
      output.contractStatus = 'PROVEN_OFFICIAL_OPEN_DATA_MACHINE_CONTRACT';
      output.productionTransportEligible = true;
    } else {
      output.contractStatus = 'OFFICIAL_TRANSPORT_REACHABLE_SCHEMA_NOT_PROVEN';
    }
  } catch (error) {
    output.fatalError = errorInfo(error, 'FNS_RSMP_PROBE_FATAL_UNKNOWN');
    output.contractStatus = 'PROBE_FATAL';
  }
  return output;
}

async function probeEaeuLabs() {
  const output = {
    schemaVersion: 'role-eligibility-eaeu-labs-source-contract-probe.v1',
    source: 'EAEU_CONFORMITY',
    authorityRoot: EAEU_LAB_REGISTER,
    legalSemantics: 'OFFICIAL_EAEU_CONFORMITY_REGISTER_POSITIVE_MEMBERSHIP_AND_STATUS',
    requiredUse: 'LABORATORY_ONLY_WITH_SCOPE_AND_STATUS_VALIDATION',
    automaticNegativeAuthority: false,
    mode: 'READ_ONLY_EXTERNAL_OBSERVATION',
    productionDatabaseMutation: 0,
    registrationTouched: false,
    resource: null,
    odata: null,
    rest: null,
    contractStatus: 'UNRESOLVED',
    productionTransportEligible: false,
  };
  try {
    const resource = await fetchOfficialBounded(EAEU_LAB_REGISTER, { kind: 'EAEU', maxBytes: 3 * 1024 * 1024 });
    const html = decode(resource.body);
    const text = visibleText(html);
    const anchors = extractAnchors(html, resource.finalUrl, 'EAEU');
    const odataData = anchors.find((entry) => /ссылка\s+на\s+odata/i.test(entry.text) && !/схем/i.test(entry.text));
    const odataSchema = anchors.find((entry) => /odata/i.test(entry.text) && /схем|описан/i.test(entry.text));
    const restData = anchors.find((entry) => /ссылка\s+на\s+rest/i.test(entry.text) && !/спецификац/i.test(entry.text));
    const restSpec = anchors.find((entry) => /rest/i.test(entry.text) && /спецификац|описан/i.test(entry.text));
    output.resource = {
      finalUrl: resource.finalUrl,
      status: resource.status,
      contentType: resource.contentType,
      sha256: resource.sha256,
      foundationObserved: /Решени[ея]\s+Совета[\s\S]{0,200}(?:№|N)\s*100/i.test(text),
      laboratoriesObserved: /Испытательные\s+лаборатории/i.test(text),
      odataDeclared: /ODATA\s+API/i.test(text),
      restDeclared: /REST\s+API/i.test(text),
      odataUrl: odataData?.url || null,
      odataSchemaUrl: odataSchema?.url || null,
      restUrl: restData?.url || null,
      restSpecUrl: restSpec?.url || null,
    };
    if (odataData && odataSchema) {
      const [dataProbe, schemaProbe] = await Promise.all([
        fetchOfficialBounded(odataData.url, { kind: 'EAEU', maxBytes: 4 * 1024 * 1024 }),
        fetchOfficialBounded(odataSchema.url, { kind: 'EAEU', maxBytes: 4 * 1024 * 1024 }),
      ]);
      const schemaText = decode(schemaProbe.body);
      output.odata = {
        dataUrl: dataProbe.finalUrl,
        dataStatus: dataProbe.status,
        dataContentType: dataProbe.contentType,
        dataSha256: dataProbe.sha256,
        schemaUrl: schemaProbe.finalUrl,
        schemaStatus: schemaProbe.status,
        schemaContentType: schemaProbe.contentType,
        schemaSha256: schemaProbe.sha256,
        schemaIdentityObserved: /ИНН|tax|taxpayer|identifier|идентификатор/i.test(schemaText),
        schemaStatusObserved: /status|статус|state|состояни/i.test(schemaText),
        schemaScopeObserved: /scope|област|technical.?regulation|техническ/i.test(schemaText),
      };
    }
    if (restData || restSpec) {
      const rest = {};
      if (restData) {
        try {
          const head = await fetchOfficialBounded(restData.url, { kind: 'EAEU', maxBytes: 0, method: 'HEAD' });
          Object.assign(rest, { dataUrl: head.finalUrl, dataStatus: head.status, dataContentType: head.contentType });
        } catch (error) {
          Object.assign(rest, { dataUrl: restData.url, dataError: errorInfo(error) });
        }
      }
      if (restSpec) {
        try {
          const spec = await fetchOfficialBounded(restSpec.url, { kind: 'EAEU', maxBytes: 4 * 1024 * 1024 });
          Object.assign(rest, { specUrl: spec.finalUrl, specStatus: spec.status, specContentType: spec.contentType, specSha256: spec.sha256 });
        } catch (error) {
          Object.assign(rest, { specUrl: restSpec.url, specError: errorInfo(error) });
        }
      }
      output.rest = rest;
    }
    const documented = output.resource.foundationObserved && output.resource.laboratoriesObserved && output.resource.odataDeclared;
    const odataMachine = output.odata?.dataStatus >= 200 && output.odata?.dataStatus < 300
      && output.odata?.schemaStatus >= 200 && output.odata?.schemaStatus < 300;
    if (documented && odataMachine) {
      output.contractStatus = 'PROVEN_OFFICIAL_EAEU_ODATA_CONTRACT';
      output.productionTransportEligible = true;
    } else if (documented) {
      output.contractStatus = 'OFFICIAL_API_DOCUMENTED_ENDPOINT_NOT_PROVEN';
    } else {
      output.contractStatus = 'OFFICIAL_REGISTER_PAGE_CONTRACT_NOT_PROVEN';
    }
  } catch (error) {
    output.fatalError = errorInfo(error, 'EAEU_LABS_PROBE_FATAL_UNKNOWN');
    output.contractStatus = 'PROBE_FATAL';
  }
  return output;
}

if (MODE === 'fns-rsmp') {
  process.stdout.write(`${JSON.stringify(await probeFnsRsmp(), null, 2)}\n`);
  process.exit(0);
}
if (MODE === 'eaeu-labs') {
  process.stdout.write(`${JSON.stringify(await probeEaeuLabs(), null, 2)}\n`);
  process.exit(0);
}
if (MODE !== 'fgis') {
  throw new Error('ROLE_ELIGIBILITY_SOURCE_PROBE_MODE_INVALID');
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
