import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

export const TARGET_MIGRATIONS = Object.freeze({
  '20260904120000_organization_capability_authority': '76ed191c53692f735bda03dfe27fae36d7f13f76837b6b21f5ea185e65c885ef',
  '20260904210000_provider_registry_authority': '8319788c3e02c692b39ce35a55b37704a08354f4a41e362b7348233e3669c49d',
  '20260904230000_integration_binding_authority': '7f990604f5824090a62305a5e0e568e12aa1fef3b3f1b73fff0b910cc7c95132',
  '20260905010000_commercial_rules_authority': '61ced1969badeb3cd257b3c8ca6fba037a3a6ffb19d60a8bbeef82e877c587a4',
  '20260905030000_service_marketplace_authority': 'cb936ef015f11aecf1e1f750807cd0af712284874ab8e5fcb99801507561c8e3',
  '20260905040000_inventory_reservation_authority': 'f10e5d8abb3247087f8b97c01b063700f7ba29f5cbcf30d209c5a6fa587b4ff4',
  '20260905100000_auction_inventory_binding': '3659a16fe4e5e5a2a755ab9510835239efa641d0c6a1991ab21f7b1f904174dd',
  '20260909120000_reconcile_historical_auction_authority': 'f3ed347bbc85d56a697d4aeafdb43ab5f351ff5c5da6a78671b88310f432c0bc',
});
export const TARGET_TABLES = Object.freeze([
  ...['organization_capability_assignments', 'organization_capability_events', 'providers', 'provider_capabilities',
    'service_offerings', 'provider_registry_evidence', 'provider_registry_events', 'integration_bindings',
    'integration_capability_evidence', 'integration_binding_events', 'commercial_rule_sets', 'commercial_rule_packs',
    'commercial_decisions', 'commercial_rule_events', 'service_marketplace_requests', 'service_marketplace_quotes',
    'service_marketplace_events'].map(name => `public.${name}`),
  ...['availability_policies', 'batches', 'positions', 'reservations', 'availability_snapshots', 'command_events'].map(name => `inventory.${name}`),
  'auction.inventory_bindings',
]);
const SAFE_ERROR = /^[A-Z][A-Z0-9_]{2,95}$/;
export function blocked(code) { throw new Error(code); }
export function errorCode(error) { return SAFE_ERROR.test(error?.message ?? '') ? error.message : 'UNCLASSIFIED_PROBE_FAILURE'; }
export function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }

// This proves route presence and unauthenticated denial only. It never creates
// a session or a business record and cannot attest an authenticated W1 command.
export async function verifyW1RouteBoundary(request = globalThis.fetch) {
  const origin = 'http://127.0.0.1:3001';
  const routes = [
    '/api/platform-v7/organization-capabilities',
    '/api/service-providers/me',
    '/api/service-providers/integration-bindings/me',
    '/api/commercial-rules/me',
    '/api/service-marketplace/me',
  ];
  const expectStatus = async (route, status, authorization) => {
    let response;
    try {
      response = await request(`${origin}${route}`, {
        method: 'GET', redirect: 'error', cache: 'no-store',
        headers: { Accept: 'application/json', ...(authorization ? { Authorization: authorization } : {}) },
        signal: AbortSignal.timeout(4000),
      });
      // Never read or publish a response body, including an unexpectedly public
      // response that could contain tenant data.
      await response.body?.cancel();
    } catch { blocked('API_ROUTE_TRANSPORT_FAILED'); }
    if (response.status !== status) blocked('API_ROUTE_BOUNDARY_FAILED');
  };
  await expectStatus('/ready', 200);
  // A blanket proxy/auth error must not masquerade as five registered routes.
  await expectStatus(`/api/pc-crop-w1-absent-${crypto.randomBytes(12).toString('hex')}`, 404);
  for (const route of routes) {
    await expectStatus(route, 401);
    await expectStatus(route, 401, 'Bearer pc-w1-invalid-credentials');
  }
  return { routes: routes.length, boundary: 'PASS', authenticatedAcceptance: 'NOT_EVIDENCED' };
}
const LEDGER_COUNTS = ['ROWS', 'MATCHED', 'DRIFTED', 'UNKNOWN', 'DUPLICATES', 'UNFINISHED', 'ROLLED_BACK', 'LEGACY_INITIAL_MARKERS'];
const LEDGER_BLOCKERS = ['APPLIED_MIGRATION_CHECKSUM_DRIFT', 'UNFINISHED_MIGRATION', 'UNRECOGNIZED_APPLIED_MIGRATION', 'DUPLICATE_APPLIED_MIGRATION', 'PENDING_SET_NOT_EXACT_EIGHT'];
// Source provenance is only one part of historical reconciliation. Production
// also requires catalog reference equality and a forward corrective migration;
// this SQL must never be replayed by the production W1 executor.
export const HISTORICAL_MIGRATIONS = Object.freeze([
  ['20260716130000_market_open_lots_showcase', '7fd0342e097c57a7a2832a7099ae973e875a5ccbddeb4cf6722d15aac983e08c', '95a762ea116607abd1c91498620ff6e6f3a13cc9'],
  ['20260716150000_auction_cross_tenant_participation', 'bc8ac2be7aad0d45e742d5669a5ae2fed4938caba0c2e11abc5962974c5c775b', 'cf9a70eb9135b2a5a6f7fd54db9fc8124540dcb1'],
  ['20260716160000_auction_participant_workspace', 'cf9d849fd6504443aac60fa7bffa0eb06b69f45b0aaf02524530f99092b1abd4', 'aa88bb9838a5846ad23cca5e239431c3e795d18e'],
  ['20260717170000_deal_cross_tenant_participation', 'e78fc2adb8332da2b242c1335d7082416f9fe4f901fbb872c186926969892598', '1bad269b02e5c50e8f9535725429d95b685020fb'],
].map(row => Object.freeze(row)));
export const HISTORICAL_FUNCTIONS = Object.freeze([
  ['market.list_open_lots', 'c7082b888eabd00420bb7f3007425290c08d32891330601e3d2f90821ddd931f', null],
  ['auction.record_admission', '9a650b0d744fe12453525dc810ac14fe0ddf6959dde7f70341f16f882b79073a', 'ee7af2664b44e3189d48ff8ce60641069a27dd4b2eebb2f23eae55dc561f6f1a'],
  ['auction.place_bid', '68cb115eb01829e921f4d06867f1f17cdcaa999c5e6207a9e97fec7b62a25e0e', '9f61cb01e25f93e9a6044c0fd59e3db96b5cedcc121ffadcfea23007917b1a0b'],
  ['dealx.participant_tenant', 'a1b0ff9212bb21b9d025804af49f0fe286adf3ea16b1d9e91682f9574a9af3b9', null],
].map(row => Object.freeze(row)));
const HISTORY_EVIDENCE = Object.freeze({
  PC_W1_HISTORY_LEDGER: /^(EXACT_FOUR_SOURCE_CHECKSUMS|UNRECONCILED)$/,
  PC_W1_HISTORY_CATALOG: /^(OBSERVED|UNAVAILABLE|NOT_OBSERVED)$/,
  PC_W1_HISTORY_CATALOG_SHA256: /^(?:[0-9a-f]{64}|NONE)$/,
  PC_W1_HISTORY_POLICIES: /^(?:[0-6]|UNKNOWN)$/,
  ...Object.fromEntries(HISTORICAL_FUNCTIONS.map((_, index) => [`PC_W1_HISTORY_FUNCTION_0${index}`,
    /^(HISTORICAL_BODY|CANONICAL_BODY|OTHER_BODY|ABSENT|AMBIGUOUS|NOT_OBSERVED)$/])),
  ...Object.fromEntries(HISTORICAL_FUNCTIONS.map((_, index) => [`PC_W1_HISTORY_FUNCTION_0${index}_SHA256`, /^(?:[0-9a-f]{64}|NONE)$/])),
});
function validHistoryEvidence(value) {
  if (!value || Object.keys(value).length !== Object.keys(HISTORY_EVIDENCE).length
    || !Object.entries(HISTORY_EVIDENCE).every(([key, pattern]) => typeof value[key] === 'string' && pattern.test(value[key]))) return false;
  const observed = value.PC_W1_HISTORY_CATALOG === 'OBSERVED';
  return (value.PC_W1_HISTORY_CATALOG_SHA256 !== 'NONE') === observed
    && (value.PC_W1_HISTORY_POLICIES !== 'UNKNOWN') === observed
    && HISTORICAL_FUNCTIONS.every(([, historical, canonical], index) => {
      const state = value[`PC_W1_HISTORY_FUNCTION_0${index}`], hash = value[`PC_W1_HISTORY_FUNCTION_0${index}_SHA256`];
      if ((state !== 'NOT_OBSERVED') !== observed) return false;
      if (['NOT_OBSERVED','ABSENT','AMBIGUOUS'].includes(state)) return hash === 'NONE';
      if (state === 'HISTORICAL_BODY') return hash === historical;
      if (state === 'CANONICAL_BODY') return canonical !== null && hash === canonical;
      return hash !== 'NONE' && hash !== historical && hash !== canonical;
    });
}
function exactHistoricalFingerprints(rows) {
  if (!Array.isArray(rows) || rows.length !== HISTORICAL_MIGRATIONS.length) return false;
  const expected = HISTORICAL_MIGRATIONS.map(([name, checksum]) =>
    [sha256(name), checksum, sha256(JSON.stringify(checksum))].join(':')).sort();
  const observed = rows.map(row => [row?.nameSha256, row?.checksumSha256, row?.valueSha256].join(':')).sort();
  return JSON.stringify(observed) === JSON.stringify(expected);
}
export async function attachHistoricalDiagnostics(tx, error, ledger) {
  if (errorCode(error) !== 'UNRECOGNIZED_APPLIED_MIGRATION') return;
  const exact = HISTORICAL_MIGRATIONS.every(([name, checksum]) => {
    const rows = ledger.filter(row => row.migration_name === name);
    return rows.length === 1 && rows[0].checksum === checksum && rows[0].finished_at != null && rows[0].rolled_back_at == null;
  }) && error.ledgerDiagnostics?.UNKNOWN === 4 && exactHistoricalFingerprints(error.ledgerDiagnostics.unknownMigrations);
  const report = { PC_W1_HISTORY_LEDGER: exact ? 'EXACT_FOUR_SOURCE_CHECKSUMS' : 'UNRECONCILED',
    PC_W1_HISTORY_CATALOG: 'UNAVAILABLE', PC_W1_HISTORY_CATALOG_SHA256: 'NONE', PC_W1_HISTORY_POLICIES: 'UNKNOWN',
    ...Object.fromEntries(HISTORICAL_FUNCTIONS.flatMap((_, index) => [[`PC_W1_HISTORY_FUNCTION_0${index}`, 'NOT_OBSERVED'],
      [`PC_W1_HISTORY_FUNCTION_0${index}_SHA256`, 'NONE']])) };
  try {
    // Fixed catalog identifiers only; no application rows or caller SQL. The
    // caller has already established a confined READ ONLY transaction.
    const functions = await tx.$queryRawUnsafe(`SELECT n.nspname || '.' || p.proname AS name,
      pg_get_function_identity_arguments(p.oid) AS arguments, p.prosrc AS body,
      p.prosecdef AS definer, p.proconfig AS config, p.proacl::text AS grants,
      pg_get_userbyid(p.proowner) AS owner
      FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
      WHERE p.prokind='f' AND n.nspname || '.' || p.proname IN
        ('market.list_open_lots','auction.record_admission','auction.place_bid','dealx.participant_tenant')
      ORDER BY 1,2 LIMIT 17`);
    const policies = await tx.$queryRawUnsafe(`SELECT schemaname,tablename,policyname,permissive,roles::text,cmd,qual,with_check
      FROM pg_catalog.pg_policies WHERE schemaname='auction' AND (tablename,policyname) IN
        (('lots','auction_lots_market_showcase_select'),('bids','auction_bids_market_showcase_select'),
         ('admissions','auction_admissions_participant_select'),('lots','auction_lots_participant_select'),
         ('bids','auction_bids_participant_select'),('awards','auction_awards_participant_select'))
      ORDER BY tablename,policyname LIMIT 7`);
    if (!Array.isArray(functions) || functions.length > 16 || !Array.isArray(policies) || policies.length > 6
      || functions.some(row => typeof row.body !== 'string')) throw new Error('CATALOG_BOUNDS_INVALID');
    report.PC_W1_HISTORY_CATALOG_SHA256 = sha256(JSON.stringify({ functions, policies }));
    report.PC_W1_HISTORY_POLICIES = String(policies.length);
    HISTORICAL_FUNCTIONS.forEach(([name, historical, canonical], index) => {
      const rows = functions.filter(row => row.name === name);
      const hash = rows.length === 1 ? sha256(rows[0].body) : null;
      report[`PC_W1_HISTORY_FUNCTION_0${index}_SHA256`] = hash ?? 'NONE';
      report[`PC_W1_HISTORY_FUNCTION_0${index}`] = !rows.length ? 'ABSENT' : rows.length > 1 ? 'AMBIGUOUS'
        : hash === historical ? 'HISTORICAL_BODY' : hash === canonical ? 'CANONICAL_BODY' : 'OTHER_BODY';
    });
    report.PC_W1_HISTORY_CATALOG = 'OBSERVED';
  } catch {
    // Catalog failure cannot erase the original ledger blocker or emit raw SQL.
  }
  error.historicalDiagnostics = report;
}
// Diagnostic only: this observation is never consulted by migration admission.
export function ledgerDiagnostics(manifest, ledger) {
  const counts = Object.fromEntries(LEDGER_COUNTS.map(key => [key, 0]));
  const names = new Set();
  const fingerprints = [];
  const unknownMigrations = [];
  for (const row of ledger) {
    counts.ROWS++;
    fingerprints.push(sha256(JSON.stringify([row.migration_name, row.checksum, row.finished_at, row.rolled_back_at])));
    if (row.rolled_back_at != null) { counts.ROLLED_BACK++; continue; }
    if (row.finished_at == null) { counts.UNFINISHED++; continue; }
    if (names.has(row.migration_name)) counts.DUPLICATES++;
    names.add(row.migration_name);
    if (!Object.hasOwn(manifest, row.migration_name)) {
      counts.UNKNOWN++;
      unknownMigrations.push({nameSha256:sha256(row.migration_name),
        checksumSha256:typeof row.checksum === 'string' && /^[0-9a-f]{64}$/.test(row.checksum) ? row.checksum : 'INVALID',
        valueSha256:sha256(JSON.stringify(row.checksum ?? null))});
      continue;
    }
    if (row.checksum === manifest[row.migration_name]) counts.MATCHED++;
    else counts.DRIFTED++;
    if (row.migration_name === '0001_postgresql_initial' && row.checksum === 'grainflow_v3_initial_postgresql') counts.LEGACY_INITIAL_MARKERS++;
  }
  unknownMigrations.sort((a,b)=>`${a.nameSha256}:${a.valueSha256}`.localeCompare(`${b.nameSha256}:${b.valueSha256}`));
  return { ...counts, SHA256: sha256(JSON.stringify(fingerprints.sort())), unknownMigrations:unknownMigrations.slice(0,32) };
}
export function probeErrorPayload(error) {
  const payload = { error: errorCode(error) };
  const drift = error?.checksumDrift;
  if (payload.error === 'APPLIED_MIGRATION_CHECKSUM_DRIFT' && drift
    && /^[0-9a-f]{64}$/.test(drift.migrationSha256 ?? '')
    && /^[0-9a-f]{64}$/.test(drift.expectedSha256 ?? '')
    && /^(?:[0-9a-f]{64}|INVALID)$/.test(drift.appliedSha256 ?? '')) {
    payload.checksumDrift = { migrationSha256: drift.migrationSha256, expectedSha256: drift.expectedSha256, appliedSha256: drift.appliedSha256 };
    if (/^[0-9a-f]{64}$/.test(drift.appliedValueSha256 ?? '')) payload.checksumDrift.appliedValueSha256 = drift.appliedValueSha256;
  }
  const ledger = error?.ledgerDiagnostics;
  if (LEDGER_BLOCKERS.includes(payload.error) && (payload.error !== 'APPLIED_MIGRATION_CHECKSUM_DRIFT' || payload.checksumDrift) && ledger
    && LEDGER_COUNTS.every(key => Number.isSafeInteger(ledger[key]) && ledger[key] >= 0 && ledger[key] <= 10000)
    && /^[0-9a-f]{64}$/.test(ledger.SHA256 ?? '')
    && Array.isArray(ledger.unknownMigrations) && ledger.unknownMigrations.length === Math.min(ledger.UNKNOWN,32)
    && ledger.unknownMigrations.every(row=>row && /^[0-9a-f]{64}$/.test(row.nameSha256 ?? '')
      && /^(?:[0-9a-f]{64}|INVALID)$/.test(row.checksumSha256 ?? '') && /^[0-9a-f]{64}$/.test(row.valueSha256 ?? ''))) {
    payload.ledgerDiagnostics = Object.fromEntries([...LEDGER_COUNTS, 'SHA256'].map(key => [key, ledger[key]]));
    payload.ledgerDiagnostics.unknownMigrations = ledger.unknownMigrations.map(row=>({nameSha256:row.nameSha256,checksumSha256:row.checksumSha256,valueSha256:row.valueSha256}));
  }
  if (payload.error === 'UNRECOGNIZED_APPLIED_MIGRATION' && payload.ledgerDiagnostics) {
    payload.historicalDiagnostics = validHistoryEvidence(error?.historicalDiagnostics) ? { ...error.historicalDiagnostics } : {
      PC_W1_HISTORY_LEDGER: 'UNRECONCILED', PC_W1_HISTORY_CATALOG: 'NOT_OBSERVED',
      PC_W1_HISTORY_CATALOG_SHA256: 'NONE', PC_W1_HISTORY_POLICIES: 'UNKNOWN',
      ...Object.fromEntries(HISTORICAL_FUNCTIONS.flatMap((_, index) => [[`PC_W1_HISTORY_FUNCTION_0${index}`, 'NOT_OBSERVED'],
        [`PC_W1_HISTORY_FUNCTION_0${index}_SHA256`, 'NONE']])),
    };
  }
  return payload;
}
export function probeDiagnostics(value) {
  const safe = probeErrorPayload({ message: value?.error, checksumDrift: value?.checksumDrift, ledgerDiagnostics: value?.ledgerDiagnostics,
    historicalDiagnostics: value?.historicalDiagnostics });
  return Object.entries(safe.checksumDrift ?? {}).map(([key, hash]) =>
    `PC_W1_CHECKSUM_DRIFT_${{migrationSha256:'MIGRATION',expectedSha256:'EXPECTED',appliedSha256:'APPLIED',appliedValueSha256:'APPLIED_VALUE'}[key]}_SHA256=${hash}\n`).join('')
    + (safe.ledgerDiagnostics ? Object.entries(safe.ledgerDiagnostics).filter(([key])=>key!=='unknownMigrations').map(([key, value]) => `PC_W1_LEDGER_${key}=${value}\n`).join('')
      + `PC_W1_UNKNOWN_DETAILS_COUNT=${safe.ledgerDiagnostics.unknownMigrations.length}\n`
      + safe.ledgerDiagnostics.unknownMigrations.map((row,index)=>Object.entries(row).map(([key,value])=>
        `PC_W1_UNKNOWN_${String(index).padStart(2,'0')}_${{nameSha256:'NAME',checksumSha256:'CHECKSUM',valueSha256:'VALUE'}[key]}_SHA256=${value}\n`).join('')).join('') : '')
    + Object.entries(safe.historicalDiagnostics ?? {}).map(([key,value]) => `${key}=${value}\n`).join('');
}
function sortedObject(value) { return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))); }

// Exact source objects audited from the historical API d401f26 and accepted
// main b262985. Both versions call record_admission/place_bid identically;
// their changed registration path is covered by the explicit old-API rollback
// degradation. Unknown source changes require a new compatibility review.
export const AUCTION_LINEAGE_API_BLOBS = Object.freeze({
  'apps/api/src/modules/auctions/auction-command.service.ts': Object.freeze({
    historical: 'bd4ea7163c37f66b7c1a9d8138012380d5819dca',
    canonical: '017d44b3532319d55d4b095355250cc6f6240ab8',
  }),
  'apps/api/src/modules/auctions/auctions.controller.ts': Object.freeze({
    historical: '4b23d4de40e6914f8376e7f1c081e1dc1bfd3ded',
    canonical: '2fc9dc262ba60bfe9850d67fa820e93c0611680b',
  }),
});
export function validateAuctionLineageApiBlobs(baseline, target) {
  const files=Object.keys(AUCTION_LINEAGE_API_BLOBS);
  for(const value of [baseline,target]) {
    if(!value || Object.keys(value).length!==files.length || files.some(file=>!Object.hasOwn(value,file))) {
      blocked('AUCTION_LINEAGE_API_SOURCE_UNAVAILABLE');
    }
  }
  for(const [file,pins] of Object.entries(AUCTION_LINEAGE_API_BLOBS)) {
    if(![pins.historical,pins.canonical].includes(baseline[file]) || target[file]!==pins.canonical) {
      blocked('AUCTION_LINEAGE_API_COMPATIBILITY_UNPROVEN');
    }
  }
}
export function verifyLineageSourceCompatibility(root, baseline, target) {
  if (![baseline,target].every(sha=>/^[0-9a-f]{40}$/.test(sha))) blocked('LINEAGE_SOURCE_REVISION_INVALID');
  const git=args=>spawnSync('git',args,{cwd:root,encoding:'utf8',timeout:120_000,maxBuffer:1024*1024});
  if (git(['merge-base','--is-ancestor',baseline,target]).status!==0) blocked('LINEAGE_BASELINE_NOT_ANCESTOR');
  for(const revision of [baseline,target]) {
    const scan=git(['grep','-I','-l','-E','list_open_lots|participant_tenant|market_showcase',revision,'--','apps/api/src']);
    if(scan.status!==1) blocked(scan.status===0 ? 'LEGACY_SQL_HELPER_CONSUMER_PRESENT' : 'LINEAGE_SOURCE_INSPECTION_FAILED');
  }
  const sourceObjects=[];
  for(const revision of [baseline,target]) {
    const scan=git(['grep','-I','-l','-F','-e','auction.record_admission','-e','auction.place_bid',revision,
      '--','apps/api/src',':(exclude)*.spec.ts']);
    if(scan.status!==0 || scan.stdout!==`${revision}:apps/api/src/modules/auctions/auction-command.service.ts\n`) {
      blocked('AUCTION_LINEAGE_SQL_CONSUMERS_UNEXPECTED');
    }
    const sources={};
    for(const file of Object.keys(AUCTION_LINEAGE_API_BLOBS)) {
      const blob=git(['rev-parse',`${revision}:${file}`]);
      if(blob.status!==0 || !/^[0-9a-f]{40}\n$/.test(blob.stdout)) blocked('AUCTION_LINEAGE_API_SOURCE_UNAVAILABLE');
      sources[file]=blob.stdout.trim();
    }
    sourceObjects.push(sources);
  }
  validateAuctionLineageApiBlobs(...sourceObjects);
  const callers=[
    'apps/api/src/modules/auctions/auctions.module.ts',
    'apps/api/src/modules/deals/industrial-deal-command.gateway.ts',
    'apps/api/src/modules/deals/prisma-deal.repository.ts',
    'apps/api/src/common/prisma/rls-transaction.service.ts',
  ];
  for(const file of callers) {
    const values=[baseline,target].map(revision=>git(['rev-parse',`${revision}:${file}`]));
    if(values.some(result=>result.status!==0 || !/^[0-9a-f]{40}\n$/.test(result.stdout))) blocked('LINEAGE_CALLER_SOURCE_UNAVAILABLE');
    if(values[0].stdout!==values[1].stdout) blocked('LINEAGE_CALLER_COMPATIBILITY_UNPROVEN');
  }
  return 'PASS';
}

// A source checksum identifies historical execution, not the current database
// authority. Rehearsal compares this catalog independently, including policies
// and grants, before a corrective migration may consume that history.
export async function observeLineageCatalog(tx) {
  const functions = await tx.$queryRawUnsafe(`SELECT n.nspname||'.'||p.proname AS name,
    pg_get_function_identity_arguments(p.oid) AS arguments,pg_get_function_result(p.oid) AS result,
    l.lanname AS language,p.prosecdef AS definer,p.proleakproof AS leakproof,
    p.provolatile::text AS volatility,p.proisstrict AS strict,p.proparallel::text AS parallel,
    p.proconfig AS config,p.prosrc AS body,
    CASE WHEN p.proowner=(SELECT relowner FROM pg_class WHERE oid='public._prisma_migrations'::regclass)
      THEN 'MIGRATION_OWNER' ELSE pg_get_userbyid(p.proowner) END AS owner,
    (SELECT jsonb_agg(jsonb_build_object('grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC'
      WHEN a.grantee=(SELECT relowner FROM pg_class WHERE oid='public._prisma_migrations'::regclass) THEN 'MIGRATION_OWNER'
      ELSE pg_get_userbyid(a.grantee) END,'privilege',a.privilege_type,'grantable',a.is_grantable) ORDER BY
      CASE WHEN a.grantee=0 THEN 'PUBLIC' WHEN a.grantee=(SELECT relowner FROM pg_class WHERE oid='public._prisma_migrations'::regclass)
      THEN 'MIGRATION_OWNER' ELSE pg_get_userbyid(a.grantee) END,a.privilege_type,a.is_grantable)
      FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a) AS grants
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang
    WHERE p.prokind='f' AND n.nspname||'.'||p.proname IN
      ('market.list_open_lots','auction.record_admission','auction.place_bid','dealx.participant_tenant')
    ORDER BY 1,2 LIMIT 17`);
  const policies = await tx.$queryRawUnsafe(`SELECT schemaname||'.'||tablename AS relation,
    policyname::text,permissive,roles::text[],cmd,qual,with_check
    FROM pg_policies WHERE schemaname='auction' AND tablename IN ('lots','bids','admissions','awards')
    ORDER BY 1,2 LIMIT 65`);
  const tables = await tx.$queryRawUnsafe(`SELECT n.nspname||'.'||c.relname AS name,
    c.relrowsecurity AS rls,c.relforcerowsecurity AS force,row_security_active(c.oid) AS active,
    CASE WHEN c.relowner=(SELECT relowner FROM pg_class WHERE oid='public._prisma_migrations'::regclass)
      THEN 'MIGRATION_OWNER' ELSE pg_get_userbyid(c.relowner) END AS owner
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='auction' AND c.relname IN ('lots','bids','admissions','awards') AND c.relkind='r'
    ORDER BY 1 LIMIT 5`);
  const indexes = await tx.$queryRawUnsafe(`SELECT n.nspname||'.'||c.relname AS name,
    i.indisvalid,i.indisready,pg_get_indexdef(c.oid) AS definition
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_index i ON i.indexrelid=c.oid
    WHERE n.nspname='auction' AND c.relname='lots_market_showcase_idx' ORDER BY 1 LIMIT 2`);
  if (!Array.isArray(functions) || functions.length > 16 || !Array.isArray(policies) || policies.length > 64
    || !Array.isArray(tables) || tables.length !== 4 || !Array.isArray(indexes) || indexes.length > 1
    || tables.some(row => !row.rls || !row.force || !row.active)
    || functions.some(row => typeof row.body !== 'string')) blocked('LINEAGE_CATALOG_INVALID');
  const bodyStates = HISTORICAL_FUNCTIONS.map(([name,historical,canonical]) => {
    const rows=functions.filter(row=>row.name===name);
    if (rows.length>1) blocked('LINEAGE_FUNCTION_OVERLOAD_UNEXPECTED');
    if (!rows.length) return 'ABSENT';
    const hash=sha256(rows[0].body);
    return hash===historical ? 'HISTORICAL' : hash===canonical ? 'CANONICAL' : 'OTHER';
  });
  const historicalPolicies = ['auction_lots_market_showcase_select','auction_bids_market_showcase_select',
    'auction_admissions_participant_select','auction_lots_participant_select','auction_bids_participant_select','auction_awards_participant_select'];
  const historicalCount=policies.filter(row=>historicalPolicies.includes(row.policyname)).length;
  let profile;
  if (bodyStates.every(state=>state==='HISTORICAL') && historicalCount===6 && indexes.length===1) profile='HISTORICAL';
  else if (JSON.stringify(bodyStates)===JSON.stringify(['ABSENT','CANONICAL','CANONICAL','ABSENT'])
    && historicalCount===0 && indexes.length===0) profile='CANONICAL';
  else blocked('LINEAGE_PROFILE_UNRECOGNIZED');
  return {profile,catalogHash:sha256(JSON.stringify({functions,policies,tables,indexes}))};
}
const MIGRATION_NAME = /^(?:0001_postgresql_initial|[0-9]{14}_[a-z0-9_]+)$/;

export function readMigrationManifest(root) {
  const result = {};
  for (const name of fs.readdirSync(root).sort()) {
    const entry = path.join(root, name);
    if (name === 'migration_lock.toml') {
      if (!fs.lstatSync(entry).isFile()) blocked('MIGRATION_LOCK_FILE_INVALID');
      continue;
    }
    if (!MIGRATION_NAME.test(name) || !fs.lstatSync(entry).isDirectory()) blocked('MIGRATION_DIRECTORY_INVALID');
    const file = path.join(entry, 'migration.sql');
    if (!fs.lstatSync(file).isFile()) blocked('MIGRATION_SQL_FILE_INVALID');
    result[name] = sha256(fs.readFileSync(file));
  }
  return validateManifest(result);
}

export function validateManifest(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.keys(value).length) blocked('REPOSITORY_MANIFEST_INVALID');
  for (const [name, checksum] of Object.entries(value)) {
    if (!MIGRATION_NAME.test(name) || !/^[0-9a-f]{64}$/.test(checksum)) blocked('REPOSITORY_MANIFEST_INVALID');
    if (HISTORICAL_MIGRATIONS.some(([archived])=>archived===name)) blocked('ARCHIVED_SQL_IN_MIGRATION_DIRECTORY');
  }
  for (const [name, checksum] of Object.entries(TARGET_MIGRATIONS)) {
    if (value[name] !== checksum) blocked('ACCEPTED_MIGRATION_CHECKSUM_MISMATCH');
  }
  return sortedObject(value);
}
export function decodeManifest(value) {
  try { return validateManifest(JSON.parse(Buffer.from(value, 'base64').toString('utf8'))); }
  catch (error) { blocked(SAFE_ERROR.test(error?.message ?? '') ? error.message : 'REPOSITORY_MANIFEST_INVALID'); }
}
export function validateImageManifest(expected, actual) {
  if (JSON.stringify(validateManifest(expected)) !== JSON.stringify(validateManifest(actual))) blocked('IMAGE_MIGRATION_SET_MISMATCH');
}
const INITIAL_MIGRATION_NAME = '0001_postgresql_initial';
const INITIAL_MIGRATION_SHA256 = '2d3708fa99e4ee855c7b9fe69dc4e4506a317ffed34330e3955f5e995d35ffdd';
// The immutable initial SQL inserted an auxiliary marker into Prisma's ledger.
// A separate completed row with the canonical checksum remains mandatory.
// This function supplies no evidence of execution and never changes the ledger.
export function redundantInitialMarker(manifest, ledger) {
  if (manifest[INITIAL_MIGRATION_NAME] !== INITIAL_MIGRATION_SHA256) return undefined;
  const rows = ledger.filter(row => row.migration_name === INITIAL_MIGRATION_NAME);
  if (rows.length !== 2 || rows.some(row => row.finished_at == null || row.rolled_back_at != null)) return undefined;
  const canonical = rows.filter(row => row.checksum === INITIAL_MIGRATION_SHA256);
  const markers = rows.filter(row => row.checksum === 'grainflow_v3_initial_postgresql');
  return canonical.length === 1 && markers.length === 1 ? markers[0] : undefined;
}
export function classifyLedger(manifestInput, ledger, { recognizeArchivedHistory = false } = {}) {
  const manifest = validateManifest(manifestInput);
  if (!Array.isArray(ledger)) blocked('MIGRATION_LEDGER_INVALID');
  const diagnostics = ledgerDiagnostics(manifest, ledger);
  try {
  if (ledger.some(row => row.finished_at == null && row.rolled_back_at == null)) blocked('UNFINISHED_MIGRATION');
  const marker = redundantInitialMarker(manifest, ledger);
  const legacyInitialMarker = marker ? 'REDUNDANT_SOURCE_MARKER' : 'ABSENT';
  const archiveNames=new Set(HISTORICAL_MIGRATIONS.map(([name])=>name));
  const archivedRows=ledger.filter(row=>archiveNames.has(row.migration_name));
  const exactArchive=recognizeArchivedHistory && archivedRows.length===4 && HISTORICAL_MIGRATIONS.every(([name,checksum])=>{
    const rows=archivedRows.filter(row=>row.migration_name===name);
    return rows.length===1 && rows[0].checksum===checksum && rows[0].finished_at!=null && rows[0].rolled_back_at==null;
  });
  if(recognizeArchivedHistory && archivedRows.length && !exactArchive) blocked('ARCHIVED_MIGRATION_SET_INVALID');
  const applied = new Map();
  for (const row of ledger) {
    if (row === marker) continue;
    if (exactArchive && archiveNames.has(row.migration_name)) continue;
    if (row.rolled_back_at != null || row.finished_at == null) continue;
    if (!Object.hasOwn(manifest, row.migration_name)) blocked('UNRECOGNIZED_APPLIED_MIGRATION');
    if (applied.has(row.migration_name)) blocked('DUPLICATE_APPLIED_MIGRATION');
    if (row.checksum !== manifest[row.migration_name]) {
      const error = new Error('APPLIED_MIGRATION_CHECKSUM_DRIFT');
      error.checksumDrift = { migrationSha256: sha256(row.migration_name), expectedSha256: manifest[row.migration_name],
        appliedSha256: typeof row.checksum === 'string' && /^[0-9a-f]{64}$/.test(row.checksum) ? row.checksum : 'INVALID',
        appliedValueSha256: sha256(JSON.stringify(row.checksum ?? null)) };
      throw error;
    }
    applied.set(row.migration_name, row);
  }
  const pending = Object.keys(manifest).filter(name => !applied.has(name));
  const lineage=exactArchive ? {historicalLineage:'EXACT_ARCHIVE'} : {};
  if (pending.length === 0) return { decision: 'VERIFIED_ALREADY_APPLIED', pendingCount: 0, legacyInitialMarker, ...lineage };
  if (JSON.stringify(pending) !== JSON.stringify(Object.keys(TARGET_MIGRATIONS))) blocked('PENDING_SET_NOT_EXACT_EIGHT');
  return { decision: 'READY_EXACT_EIGHT', pendingCount: 8, legacyInitialMarker, ...lineage };
  } catch (error) {
    if (LEDGER_BLOCKERS.includes(errorCode(error))) error.ledgerDiagnostics = diagnostics;
    throw error;
  }
}

export function validateApiEnvironment(env) {
  if (env.NODE_ENV !== 'production') blocked('API_NOT_PRODUCTION');
  for (const name of ['DEAL', 'DOCUMENT', 'SHIPMENT', 'LAB', 'PAYMENT']) {
    if (env[`PLATFORM_V7_${name}_REPOSITORY`] !== 'prisma') blocked('NON_POSTGRESQL_RUNTIME_AUTHORITY');
  }
  for (const [key, raw] of Object.entries(env)) {
    const value = String(raw ?? '').trim().toLowerCase();
    if (key.endsWith('_MODE') && ['stub', 'mock', 'fake', 'demo', 'sandbox', 'test'].includes(value)) blocked('NON_LIVE_INTEGRATION_MODE_ENABLED');
  }
  for (const key of ['AUTH_TEST_ACCOUNTS_ENABLED', 'ALLOW_RUNTIME_MUTATION']) {
    if (['1', 'true'].includes(String(env[key] ?? '').trim().toLowerCase())) blocked('TEST_RUNTIME_ENABLED');
  }
  if (['1', 'true'].includes(String(env.ROLE_ELIGIBILITY_ENFORCEMENT ?? '').trim().toLowerCase())) blocked('ELIGIBILITY_ENFORCEMENT_ENABLED');
  // The accepted API service defaults absent/empty shadow mode to true.
  if (String(env.ROLE_ELIGIBILITY_SHADOW_MODE || 'true').toLowerCase() !== 'true') blocked('ELIGIBILITY_SHADOW_NOT_CONFIRMED');
}

export function validateSnapshot(value) {
  if (!value || typeof value !== 'object' || value.error) blocked(value?.error && SAFE_ERROR.test(value.error) ? value.error : 'SNAPSHOT_PROBE_INVALID');
  if (!/^[0-9A-F]{8}-[0-9A-F]{8}-[1-9][0-9]*$/.test(value.snapshot ?? '')) blocked('SNAPSHOT_TOKEN_INVALID');
  if (!/^pc_w1_[0-9a-f]{32}$/.test(value.nonce ?? '')) blocked('SNAPSHOT_NONCE_INVALID');
  for (const key of ['pid', 'databaseOid', 'roleOid']) if (!Number.isSafeInteger(value[key]) || value[key] <= 0) blocked('SNAPSHOT_IDENTITY_INVALID');
  if (!['READY_EXACT_EIGHT', 'VERIFIED_ALREADY_APPLIED'].includes(value.decision)) blocked('SNAPSHOT_DECISION_INVALID');
  if (!['ABSENT','REDUNDANT_SOURCE_MARKER'].includes(value.legacyInitialMarker)) blocked('INITIAL_MARKER_EVIDENCE_MISSING');
  if (value.pendingCount !== (value.decision === 'READY_EXACT_EIGHT' ? 8 : 0)) blocked('SNAPSHOT_PENDING_COUNT_INVALID');
  if (!/^[0-9a-f]{64}$/.test(value.environmentHash ?? '')) blocked('API_ENVIRONMENT_HASH_INVALID');
  if (value.tables !== (value.pendingCount === 8 ? 0 : 24)
    || !(value.pendingCount === 8 ? ['NOT_APPLIED'] : ['PASS','OBSERVED_NOT_MATCHED']).includes(value.structuralChecks)) blocked('SNAPSHOT_SCHEMA_INVALID');
  if (value.pendingCount === 0 && !/^[0-9a-f]{64}$/.test(value.catalogHash ?? '')) blocked('SNAPSHOT_CATALOG_HASH_INVALID');
  if(!['ABSENT','EXACT_ARCHIVE'].includes(value.historicalLineage) || !['PASS','OBSERVED_NOT_MATCHED'].includes(value.lineageChecks)
    || !/^[0-9a-f]{64}$/.test(value.lineageCatalogHash ?? '')
    || value.lineageProfile!==(value.pendingCount===8 && value.historicalLineage==='EXACT_ARCHIVE' ? 'HISTORICAL' : 'CANONICAL')) blocked('SNAPSHOT_LINEAGE_INVALID');
  return value;
}
export function snapshotSql(input) {
  const value = validateSnapshot(input);
  return `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET TRANSACTION SNAPSHOT '${value.snapshot}';
SET LOCAL statement_timeout = '15000ms';
DO $pc_w1_identity$
BEGIN
  IF current_setting('transaction_read_only') <> 'on' THEN RAISE EXCEPTION 'READ_ONLY_REQUIRED'; END IF;
  IF pg_is_in_recovery() THEN RAISE EXCEPTION 'PRIMARY_DATABASE_REQUIRED'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_database WHERE datname=current_database() AND oid=${value.databaseOid})
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_stat_activity WHERE pid=${value.pid} AND datid=${value.databaseOid}
      AND usesysid=${value.roleOid} AND application_name='${value.nonce}')
  THEN RAISE EXCEPTION 'API_MIGRATION_DATABASE_MISMATCH'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=current_user AND (rolsuper OR rolcreaterole))
    OR NOT pg_has_role(current_user,(SELECT relowner FROM pg_catalog.pg_class WHERE oid='public._prisma_migrations'::regclass),'USAGE')
  THEN RAISE EXCEPTION 'MIGRATION_PRINCIPAL_AUTHORITY_REQUIRED'; END IF;
END
$pc_w1_identity$;
COMMIT;
`;
}

export function validateMigrationImage(image, target, digest) {
  if (!/^[0-9a-f]{40}$/.test(target ?? '') || !/^ghcr\.io\/pachaninm-lab\/grainflow-migration@sha256:[0-9a-f]{64}$/.test(digest ?? '')) blocked('MIGRATION_IMAGE_REFERENCE_INVALID');
  if (!image?.RepoDigests?.includes(digest) || !/^sha256:[0-9a-f]{64}$/.test(image.Id ?? '')) blocked('MIGRATION_IMAGE_DIGEST_MISMATCH');
  const config = image.Config;
  if (config?.Labels?.['org.opencontainers.image.revision'] !== target) blocked('MIGRATION_IMAGE_REVISION_MISMATCH');
  if (!['nonroot', '65532', '65532:65532', 'nonroot:nonroot'].includes(config.User)) blocked('MIGRATION_IMAGE_USER_INVALID');
  if (config.WorkingDir !== '/app' || JSON.stringify(config.Entrypoint) !== JSON.stringify(['/nodejs/bin/node'])
    || JSON.stringify(config.Cmd) !== JSON.stringify(['node_modules/prisma/build/index.js','migrate','deploy','--schema','prisma/schema.prisma'])) blocked('MIGRATION_IMAGE_COMMAND_INVALID');
}

export function validateCompose(config) {
  const services = Object.entries(config?.services ?? {});
  const candidates = services.filter(([, service]) => /^ghcr\.io\/pachaninm-lab\/grainflow-migration(?::|@)/.test(service.image ?? ''));
  if (candidates.length !== 1) blocked('MIGRATION_SERVICE_AMBIGUOUS');
  const [name, migration] = candidates[0];
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(name)) blocked('MIGRATION_SERVICE_NAME_INVALID');
  // Existing migration network and credentials stay authoritative. Arbitrary
  // bind mounts, alternate commands or root users must not replace image code.
  if (migration.volumes?.length || migration.configs?.length || migration.secrets?.length
    || migration.entrypoint != null || migration.command != null || migration.user != null || migration.working_dir != null
    || migration.privileged || migration.network_mode === 'host') blocked('MIGRATION_SERVICE_RUNTIME_OVERRIDE');
  if (!config.services.api) blocked('API_COMPOSE_SERVICE_MISSING');
  return name;
}

export function runtimeFingerprint(containers, excludedApi) {
  if (!Array.isArray(containers) || !containers.length) blocked('RUNTIME_CONTAINER_INVENTORY_EMPTY');
  const inventory = containers.filter(item => item.Id !== excludedApi).map(item => {
    if (!/^[0-9a-f]{64}$/.test(item.Id ?? '') || !item.State?.StartedAt || !/^sha256:[0-9a-f]{64}$/.test(item.Image ?? '')) blocked('RUNTIME_CONTAINER_IDENTITY_INVALID');
    if (item.State.Running && (String(item.Config?.Labels?.['com.docker.compose.service'] ?? '').includes('role-eligibility')
      || JSON.stringify(item.Config?.Cmd ?? []).includes('role-eligibility-worker'))) {
      const env=Object.fromEntries((item.Config?.Env ?? []).map(value => { const index=value.indexOf('='); return [value.slice(0,index),value.slice(index+1)]; }));
      if (env.ROLE_ELIGIBILITY_SHADOW_MODE !== 'true' || String(env.ROLE_ELIGIBILITY_ENFORCEMENT ?? '').trim().toLowerCase() === 'true') blocked('ELIGIBILITY_WORKER_NOT_SHADOW');
    }
    return { id: item.Id, image: item.Image, state: { running: item.State.Running, startedAt: item.State.StartedAt },
      config: item.Config, host: item.HostConfig, mounts: item.Mounts,
      networks: Object.fromEntries(Object.entries(item.NetworkSettings?.Networks ?? {}).map(([name, network]) => [name, {
        NetworkID: network.NetworkID, EndpointID: network.EndpointID, IPAddress: network.IPAddress,
      }]).sort(([a],[b]) => a.localeCompare(b))) };
  }).sort((a,b) => a.id.localeCompare(b.id));
  return sha256(JSON.stringify(inventory));
}

export const EVIDENCE_VALUES = Object.freeze({
  ...HISTORY_EVIDENCE,
  PC_W1_RESULT: /^(READY_EXACT_EIGHT|VERIFIED_ALREADY_APPLIED|MIGRATIONS_APPLIED_PENDING_API_ACCEPTANCE|BLOCKED)$/,
  PC_W1_ERROR: SAFE_ERROR,
  PC_W1_LEGACY_INITIAL_MARKER: /^(ABSENT|REDUNDANT_SOURCE_MARKER)$/,
  PC_W1_CHECKSUM_DRIFT_MIGRATION_SHA256: /^[0-9a-f]{64}$/,
  PC_W1_CHECKSUM_DRIFT_EXPECTED_SHA256: /^[0-9a-f]{64}$/,
  PC_W1_CHECKSUM_DRIFT_APPLIED_SHA256: /^(?:[0-9a-f]{64}|INVALID)$/,
  PC_W1_CHECKSUM_DRIFT_APPLIED_VALUE_SHA256: /^[0-9a-f]{64}$/,
  ...Object.fromEntries(LEDGER_COUNTS.map(key => [`PC_W1_LEDGER_${key}`, /^(?:0|[1-9][0-9]{0,3}|10000)$/])),
  PC_W1_LEDGER_SHA256: /^[0-9a-f]{64}$/,
  PC_W1_UNKNOWN_DETAILS_COUNT: /^(?:[0-9]|[12][0-9]|3[0-2])$/,
  ...Object.fromEntries(Array.from({length:32},(_,index)=>['NAME','CHECKSUM','VALUE'].map(field=>
    [`PC_W1_UNKNOWN_${String(index).padStart(2,'0')}_${field}_SHA256`,field==='CHECKSUM'?/^(?:[0-9a-f]{64}|INVALID)$/:/^[0-9a-f]{64}$/])).flat()),
  PC_W1_TARGET_SHA: /^[0-9a-f]{40}$/,
  PC_W1_BASELINE_API_SHA: /^[0-9a-f]{40}$/,
  PC_W1_ARCHIVED_LEDGER: /^(ABSENT|EXACT_ARCHIVE)$/,
  PC_W1_LINEAGE_PROFILE: /^(CANONICAL|HISTORICAL)$/,
  PC_W1_LINEAGE_CHECKS: /^(PASS|OBSERVED_NOT_MATCHED)$/,
  PC_W1_LINEAGE_CATALOG_SHA256: /^[0-9a-f]{64}$/,
  PC_W1_DATABASE_IDENTITY: /^PASS$/,
  PC_W1_PENDING_MIGRATIONS: /^(0|8)$/,
  PC_W1_SCHEMA_TABLES: /^(0|24)$/,
  PC_W1_SCHEMA_STRUCTURAL_CHECKS: /^(PASS|NOT_APPLIED|OBSERVED_NOT_MATCHED)$/,
  PC_W1_SCHEMA_CATALOG_SHA256: /^[0-9a-f]{64}$/,
  PC_W1_API_ENVIRONMENT_SHA256: /^[0-9a-f]{64}$/,
  PC_W1_NON_API_RUNTIME_SHA256: /^[0-9a-f]{64}$/,
  PC_W1_RUNTIME_UNCHANGED: /^PASS$/,
  PC_W1_BACKUP_SHA256: /^[0-9a-f]{64}$/,
  PC_W1_BACKUP_BYTES: /^[1-9][0-9]{0,19}$/,
  PC_W1_BACKUP_VERIFICATION: /^ARCHIVE_LIST_ONLY$/,
  PC_W1_DATABASE_ROLLBACK: /^NOT_REHEARSED$/,
  PC_W1_DATABASE_MUTATION: /^(NONE|BOUNDED_EIGHT_MIGRATIONS|MAY_HAVE_PARTIALLY_APPLIED)$/,
  PC_W1_AUTHENTICATED_ACCEPTANCE: /^NOT_EVIDENCED$/,
  PC_W1_FULL_ACCEPTANCE: /^NOT_EVIDENCED$/,
  PC_W1_LEGACY_LOT_ROLLBACK: /^DEGRADED_FAIL_CLOSED$/,
});
export function parseEvidence(raw, { requireTerminal = true } = {}) {
  const result = Object.create(null);
  for (const line of String(raw).trim().split(/\r?\n/)) {
    const separator = line.indexOf('=');
    const key = line.slice(0, separator), value = line.slice(separator + 1);
    if (separator < 1 || !Object.hasOwn(EVIDENCE_VALUES, key) || !EVIDENCE_VALUES[key].test(value)) blocked('UNSAFE_REMOTE_OUTPUT');
    if (Object.hasOwn(result, key)) blocked('DUPLICATE_REMOTE_EVIDENCE');
    result[key] = value;
  }
  if (requireTerminal && !result.PC_W1_RESULT) blocked('MISSING_TERMINAL_EVIDENCE');
  if (result.PC_W1_RESULT === 'BLOCKED' && !result.PC_W1_ERROR) blocked('MISSING_BLOCKER_CODE');
  const driftKeys = Object.keys(result).filter(key => key.startsWith('PC_W1_CHECKSUM_DRIFT_'));
  if (driftKeys.length && (![3,4].includes(driftKeys.length) || !result.PC_W1_CHECKSUM_DRIFT_MIGRATION_SHA256
    || !result.PC_W1_CHECKSUM_DRIFT_EXPECTED_SHA256 || !result.PC_W1_CHECKSUM_DRIFT_APPLIED_SHA256 || result.PC_W1_RESULT !== 'BLOCKED'
    || result.PC_W1_ERROR !== 'APPLIED_MIGRATION_CHECKSUM_DRIFT')) blocked('CONTRADICTORY_CHECKSUM_DIAGNOSTICS');
  const ledgerKeys = Object.keys(result).filter(key => key.startsWith('PC_W1_LEDGER_'));
  const unknownKeys = Object.keys(result).filter(key=>key.startsWith('PC_W1_UNKNOWN_'));
  if (ledgerKeys.length || unknownKeys.length || LEDGER_BLOCKERS.includes(result.PC_W1_ERROR)) {
    const count = key => Number(result[`PC_W1_LEDGER_${key}`]);
    const blocker = result.PC_W1_ERROR;
    const requiredCount = {APPLIED_MIGRATION_CHECKSUM_DRIFT:'DRIFTED',UNFINISHED_MIGRATION:'UNFINISHED',UNRECOGNIZED_APPLIED_MIGRATION:'UNKNOWN',DUPLICATE_APPLIED_MIGRATION:'DUPLICATES'}[blocker];
    if (ledgerKeys.length !== LEDGER_COUNTS.length + 1 || result.PC_W1_RESULT !== 'BLOCKED'
      || !LEDGER_BLOCKERS.includes(blocker) || result.PC_W1_DATABASE_MUTATION !== 'NONE'
      || (blocker === 'APPLIED_MIGRATION_CHECKSUM_DRIFT' && driftKeys.length !== 4)
      || (requiredCount && count(requiredCount) < 1)
      || count('ROWS') !== ['MATCHED','DRIFTED','UNKNOWN','UNFINISHED','ROLLED_BACK'].reduce((n,key) => n+count(key),0)
      || count('DUPLICATES') > count('MATCHED')+count('DRIFTED')+count('UNKNOWN')
      || count('LEGACY_INITIAL_MARKERS') > count('DRIFTED')) blocked('CONTRADICTORY_LEDGER_DIAGNOSTICS');
    const detailCount=Number(result.PC_W1_UNKNOWN_DETAILS_COUNT);
    if (detailCount !== Math.min(count('UNKNOWN'),32) || unknownKeys.length !== 1+detailCount*3) blocked('INCOMPLETE_UNKNOWN_MIGRATION_DIAGNOSTICS');
    for(let index=0;index<detailCount;index++) for(const field of ['NAME','CHECKSUM','VALUE']) {
      if (!result[`PC_W1_UNKNOWN_${String(index).padStart(2,'0')}_${field}_SHA256`]) blocked('INCOMPLETE_UNKNOWN_MIGRATION_DIAGNOSTICS');
    }
  }
  const history = Object.fromEntries(Object.entries(result).filter(([key]) => key.startsWith('PC_W1_HISTORY_')));
  const historyRows = Array.from({length:4}, (_, index) => ({
    nameSha256: result[`PC_W1_UNKNOWN_0${index}_NAME_SHA256`],
    checksumSha256: result[`PC_W1_UNKNOWN_0${index}_CHECKSUM_SHA256`],
    valueSha256: result[`PC_W1_UNKNOWN_0${index}_VALUE_SHA256`],
  }));
  if ((Object.keys(history).length || result.PC_W1_ERROR === 'UNRECOGNIZED_APPLIED_MIGRATION') && (!validHistoryEvidence(history) || result.PC_W1_RESULT !== 'BLOCKED'
    || result.PC_W1_ERROR !== 'UNRECOGNIZED_APPLIED_MIGRATION' || result.PC_W1_DATABASE_MUTATION !== 'NONE'
    || (history.PC_W1_HISTORY_LEDGER === 'EXACT_FOUR_SOURCE_CHECKSUMS'
      && (result.PC_W1_LEDGER_UNKNOWN !== '4' || !exactHistoricalFingerprints(historyRows))))) {
    blocked('CONTRADICTORY_HISTORY_DIAGNOSTICS');
  }
  if (result.PC_W1_RESULT && result.PC_W1_RESULT !== 'BLOCKED') {
    if (result.PC_W1_ERROR) blocked('CONTRADICTORY_REMOTE_EVIDENCE');
    for (const key of ['PC_W1_LEGACY_INITIAL_MARKER', 'PC_W1_TARGET_SHA', 'PC_W1_BASELINE_API_SHA', 'PC_W1_DATABASE_IDENTITY', 'PC_W1_PENDING_MIGRATIONS',
      'PC_W1_SCHEMA_TABLES', 'PC_W1_SCHEMA_STRUCTURAL_CHECKS', 'PC_W1_RUNTIME_UNCHANGED', 'PC_W1_DATABASE_MUTATION',
      'PC_W1_AUTHENTICATED_ACCEPTANCE', 'PC_W1_FULL_ACCEPTANCE', 'PC_W1_LEGACY_LOT_ROLLBACK',
      'PC_W1_API_ENVIRONMENT_SHA256', 'PC_W1_NON_API_RUNTIME_SHA256', 'PC_W1_DATABASE_ROLLBACK',
      'PC_W1_ARCHIVED_LEDGER','PC_W1_LINEAGE_PROFILE','PC_W1_LINEAGE_CHECKS','PC_W1_LINEAGE_CATALOG_SHA256']) {
      if (!result[key]) blocked('INCOMPLETE_REMOTE_EVIDENCE');
    }
    if (result.PC_W1_FULL_ACCEPTANCE !== 'NOT_EVIDENCED' || result.PC_W1_AUTHENTICATED_ACCEPTANCE !== 'NOT_EVIDENCED') blocked('FALSE_FUNCTIONAL_ACCEPTANCE');
    if(result.PC_W1_LINEAGE_PROFILE!==(result.PC_W1_RESULT==='READY_EXACT_EIGHT' && result.PC_W1_ARCHIVED_LEDGER==='EXACT_ARCHIVE' ? 'HISTORICAL' : 'CANONICAL')) blocked('CONTRADICTORY_LINEAGE_EVIDENCE');
    if (result.PC_W1_RESULT === 'MIGRATIONS_APPLIED_PENDING_API_ACCEPTANCE') {
      if(result.PC_W1_LINEAGE_CHECKS!=='PASS') blocked('LINEAGE_REFERENCE_REQUIRED');
      if (!result.PC_W1_BACKUP_SHA256 || !result.PC_W1_BACKUP_BYTES || !result.PC_W1_BACKUP_VERIFICATION || result.PC_W1_DATABASE_MUTATION !== 'BOUNDED_EIGHT_MIGRATIONS') blocked('MISSING_MUTATION_BACKUP_EVIDENCE');
    } else if (result.PC_W1_DATABASE_MUTATION !== 'NONE') blocked('UNEXPECTED_MUTATION_EVIDENCE');
    if (result.PC_W1_RESULT === 'READY_EXACT_EIGHT') {
      if (result.PC_W1_PENDING_MIGRATIONS !== '8' || result.PC_W1_SCHEMA_TABLES !== '0' || result.PC_W1_SCHEMA_STRUCTURAL_CHECKS !== 'NOT_APPLIED') blocked('PRE_MIGRATION_EVIDENCE_INVALID');
    } else if (!result.PC_W1_SCHEMA_CATALOG_SHA256) {
      blocked('MISSING_SCHEMA_CATALOG_EVIDENCE');
    }
    if (result.PC_W1_RESULT !== 'READY_EXACT_EIGHT' && (result.PC_W1_PENDING_MIGRATIONS !== '0' || result.PC_W1_SCHEMA_TABLES !== '24'
      || !['PASS','OBSERVED_NOT_MATCHED'].includes(result.PC_W1_SCHEMA_STRUCTURAL_CHECKS))) blocked('POST_MIGRATION_EVIDENCE_INVALID');
    if (result.PC_W1_RESULT === 'MIGRATIONS_APPLIED_PENDING_API_ACCEPTANCE' && result.PC_W1_SCHEMA_STRUCTURAL_CHECKS !== 'PASS') blocked('CATALOG_REFERENCE_REQUIRED');
  }
  return result;
}

async function observeSchema(tx, applied, lineage) {
  const rows = await tx.$queryRawUnsafe(`SELECT n.nspname||'.'||c.relname AS name,c.relrowsecurity AS rls,c.relforcerowsecurity AS force,
    row_security_active(c.oid) AS active,CASE WHEN c.relowner=(SELECT relowner FROM pg_class WHERE oid='public._prisma_migrations'::regclass) THEN 'MIGRATION_OWNER' ELSE r.rolname END AS owner
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_catalog.pg_roles r ON r.oid=c.relowner WHERE n.nspname||'.'||c.relname = ANY($1::text[]) ORDER BY 1`, TARGET_TABLES);
  if (!applied) {
    if (rows.length) blocked('TARGET_SCHEMA_PREEXISTS');
    return { tables: 0, structuralChecks: 'NOT_APPLIED' };
  }
  if (rows.length !== 24 || rows.some(row => !row.rls || !row.force || !row.active)) blocked('TARGET_SCHEMA_RLS_INVALID');
  const authorities = await tx.$queryRawUnsafe(`SELECT r.rolcanlogin,r.rolinherit,r.rolsuper,r.rolbypassrls,r.rolcreatedb,r.rolcreaterole,
    EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members m WHERE m.roleid=r.oid OR m.member=r.oid) AS membership
    FROM pg_catalog.pg_roles r WHERE r.rolname='pc_inventory_authority'`);
  if (authorities.length !== 1 || Object.values(authorities[0]).some(value => value !== false)) blocked('INVENTORY_AUTHORITY_INVALID');
  for (const table of rows.filter(row => row.name.startsWith('inventory.') || row.name === 'auction.inventory_bindings')) {
    if (table.owner !== 'pc_inventory_authority') blocked('INVENTORY_TABLE_OWNER_INVALID');
  }
  const functions = await tx.$queryRawUnsafe(`SELECT n.nspname||'.'||p.proname AS name,p.prosecdef,p.proconfig,r.rolname::text AS owner,
    pg_get_functiondef(p.oid) AS definition,
    EXISTS(SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') AS public_execute,
    has_function_privilege(current_user,p.oid,'EXECUTE') AS executable
    FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_roles r ON r.oid=p.proowner
    WHERE p.oid IN (to_regprocedure('inventory.execute_command(jsonb)'),to_regprocedure('auction.register_inventory_lot(jsonb)')) ORDER BY 1`);
  if (functions.length !== 2 || functions.some(row => !row.prosecdef || row.owner !== 'pc_inventory_authority' || row.public_execute || !row.executable
    || !row.proconfig?.includes('row_security=on') || !row.proconfig.some(value => /^search_path=pg_catalog, public, (inventory|auction, inventory)$/.test(value)))) blocked('INVENTORY_COMMAND_AUTHORITY_INVALID');
  const triggers = await tx.$queryRawUnsafe(`SELECT n.nspname||'.'||c.relname AS relation,t.tgname::text,t.tgenabled::text,t.tgdeferrable,t.tginitdeferred,
    pn.nspname||'.'||p.proname AS function,pg_get_triggerdef(t.oid) AS definition
    FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid JOIN pg_catalog.pg_namespace pn ON pn.oid=p.pronamespace
    WHERE NOT t.tgisinternal AND (n.nspname||'.'||c.relname=ANY($1::text[]) OR (n.nspname='auction' AND c.relname='lots')) ORDER BY 1,2`, TARGET_TABLES);
  if (triggers.some(row => row.tgenabled !== 'O' && row.tgenabled !== 'A')) blocked('TARGET_TRIGGER_DISABLED');
  for (const [relation, trigger, fn] of [
    ['public.organization_capability_assignments','organization_capability_assignment_guard','public.app_organization_capability_guard_assignment'],
    ['public.organization_capability_events','organization_capability_event_guard','public.app_organization_capability_guard_event'],
    ['public.providers','provider_registry_provider_guard','public.app_provider_registry_guard_provider'],
    ['public.provider_capabilities','provider_registry_capability_guard','public.app_provider_registry_guard_capability'],
    ['public.service_offerings','provider_registry_offering_guard','public.app_provider_registry_guard_offering'],
    ['public.provider_registry_evidence','provider_registry_evidence_guard','public.app_provider_registry_guard_evidence'],
    ['public.provider_registry_events','provider_registry_event_guard','public.app_provider_registry_guard_event'],
    ['public.integration_bindings','integration_binding_guard','public.app_integration_binding_guard'],
    ['public.integration_capability_evidence','integration_capability_evidence_guard','public.app_integration_capability_evidence_guard'],
    ['public.integration_binding_events','integration_binding_event_guard','public.app_integration_binding_event_guard'],
    ['public.commercial_rule_sets','commercial_rule_set_guard','public.app_commercial_version_guard'],
    ['public.commercial_rule_packs','commercial_rule_pack_guard','public.app_commercial_version_guard'],
    ['public.commercial_decisions','commercial_decision_guard','public.app_commercial_decision_guard'],
    ['public.commercial_rule_events','commercial_rule_event_guard','public.app_commercial_rule_event_guard'],
    ['public.commercial_rule_sets','commercial_rule_set_evidence_guard','public.app_commercial_version_evidence_guard'],
    ['public.commercial_rule_packs','commercial_rule_pack_evidence_guard','public.app_commercial_version_evidence_guard'],
    ['public.service_marketplace_requests','service_marketplace_request_guard','public.app_service_marketplace_request_guard'],
    ['public.service_marketplace_quotes','service_marketplace_quote_guard','public.app_service_marketplace_quote_guard'],
    ['public.service_marketplace_events','service_marketplace_event_guard','public.app_service_marketplace_event_guard'],
    ['public.service_marketplace_requests','service_marketplace_request_evidence_guard','public.app_service_marketplace_evidence_guard'],
    ...['batches','positions','reservations','availability_snapshots','command_events'].flatMap(table =>
      ['inventory_private_write','inventory_no_truncate'].map(trigger => [`inventory.${table}`,trigger,'inventory.private_write_guard'])),
    ['inventory.availability_policies','inventory_policy_immutable','inventory.private_write_guard'],
    ['inventory.availability_policies','inventory_policy_no_truncate','inventory.private_write_guard'],
    ['auction.lots','auction_inventory_lot_write','auction.inventory_lot_write_guard'],
    ['auction.lots','auction_inventory_registration_evidence','auction.inventory_registration_evidence_guard'],
    ['inventory.reservations','auction_bound_reservation_guard','auction.inventory_reservation_guard'],
    ['auction.inventory_bindings','auction_inventory_binding_immutable','inventory.private_write_guard'],
    ['auction.inventory_bindings','auction_inventory_binding_no_truncate','inventory.private_write_guard'],
  ]) if (!triggers.some(row => row.relation === relation && row.tgname === trigger && row.function === fn)) blocked('TARGET_TRIGGER_MISSING');
  const deferred = triggers.find(row => row.tgname === 'auction_inventory_registration_evidence');
  if (!deferred.tgdeferrable || !deferred.tginitdeferred) blocked('DEFERRED_EVIDENCE_TRIGGER_INVALID');
  const policies = await tx.$queryRawUnsafe(`SELECT schemaname||'.'||tablename AS relation,policyname::text,permissive,roles::text[],cmd,qual,with_check
    FROM pg_catalog.pg_policies WHERE schemaname||'.'||tablename=ANY($1::text[]) ORDER BY 1,2`, TARGET_TABLES);
  if (TARGET_TABLES.some(table => !policies.some(policy => policy.relation === table))) blocked('TARGET_POLICY_MISSING');
  const policy = await tx.$queryRawUnsafe('SELECT id,version::text AS version,definition FROM inventory.availability_policies ORDER BY id');
  const expectedPolicy = { basis:'declaredQuantity',exclusiveBuckets:['availableQuantity','reservedQuantity','committedQuantity','blockedQuantity','disputedQuantity','depletedQuantity'],
    formula:'declared - reserved - committed - blocked - disputed - depleted',independentMeasures:['confirmedQuantity','shippedQuantity','acceptedQuantity','soldQuantity'],
    supportedCommands:['DECLARE','RESERVE','RELEASE'],independentVerificationCreated:false,financialObligationCreated:false };
  if (policy.length !== 1 || policy[0].id !== 'DECLARED_CAPACITY_V1' || policy[0].version !== '1'
    || JSON.stringify(sortedObject(policy[0].definition)) !== JSON.stringify(sortedObject(expectedPolicy))) blocked('STATIC_AVAILABILITY_POLICY_INVALID');
  const constraints = await tx.$queryRawUnsafe(`SELECT n.nspname||'.'||c.relname AS relation,k.conname::text,k.contype::text,k.convalidated,k.condeferrable,k.condeferred,
    pg_get_constraintdef(k.oid) AS definition FROM pg_catalog.pg_constraint k JOIN pg_catalog.pg_class c ON c.oid=k.conrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname||'.'||c.relname=ANY($1::text[])
      OR (n.nspname='auction' AND c.relname='lots' AND k.conname='auction_lot_inventory_binding_fk') ORDER BY 1,2`, TARGET_TABLES);
  const bindingFk = constraints.find(row => row.conname === 'auction_lot_inventory_binding_fk');
  if (!bindingFk?.convalidated || !bindingFk.condeferrable || !bindingFk.condeferred || constraints.some(row => !row.convalidated)) blocked('TARGET_CONSTRAINT_INVALID');
  const columns = await tx.$queryRawUnsafe(`SELECT n.nspname||'.'||c.relname AS relation,a.attnum,a.attname::text,
    format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull,pg_get_expr(d.adbin,d.adrelid) AS default_expression,a.attidentity::text,a.attgenerated::text
    FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE a.attnum>0 AND NOT a.attisdropped AND n.nspname||'.'||c.relname=ANY($1::text[]) ORDER BY 1,a.attnum`, TARGET_TABLES);
  const indexes = await tx.$queryRawUnsafe(`SELECT n.nspname||'.'||c.relname AS relation,i.indisvalid,i.indisready,pg_get_indexdef(i.indexrelid) AS definition
    FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname||'.'||c.relname=ANY($1::text[]) ORDER BY 1,4`, TARGET_TABLES);
  if (indexes.some(row => !row.indisvalid || !row.indisready)) blocked('TARGET_INDEX_INVALID');
  const grants = await tx.$queryRawUnsafe(`SELECT n.nspname||'.'||c.relname AS relation,
    CASE WHEN a.grantee=0 THEN 'PUBLIC' WHEN a.grantee=(SELECT relowner FROM pg_class WHERE oid='public._prisma_migrations'::regclass)
      THEN 'MIGRATION_OWNER' ELSE pg_get_userbyid(a.grantee) END AS grantee,a.privilege_type,a.is_grantable
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl,acldefault('r',c.relowner))) a
    WHERE n.nspname||'.'||c.relname=ANY($1::text[]) ORDER BY 1,2,3,4`, TARGET_TABLES);
  const guardFunctions = await tx.$queryRawUnsafe(`SELECT n.nspname||'.'||p.proname AS name,pg_get_function_identity_arguments(p.oid) AS arguments,
    p.prosecdef,p.proconfig,CASE WHEN p.proowner=(SELECT relowner FROM pg_class WHERE oid='public._prisma_migrations'::regclass)
      THEN 'MIGRATION_OWNER' ELSE pg_get_userbyid(p.proowner) END AS owner,pg_get_functiondef(p.oid) AS definition,
    (SELECT jsonb_agg(jsonb_build_object('grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC'
      WHEN a.grantee=(SELECT relowner FROM pg_class WHERE oid='public._prisma_migrations'::regclass) THEN 'MIGRATION_OWNER'
      ELSE pg_get_userbyid(a.grantee) END,'privilege',a.privilege_type,'grantable',a.is_grantable) ORDER BY
      CASE WHEN a.grantee=0 THEN 'PUBLIC' WHEN a.grantee=(SELECT relowner FROM pg_class WHERE oid='public._prisma_migrations'::regclass)
      THEN 'MIGRATION_OWNER' ELSE pg_get_userbyid(a.grantee) END,a.privilege_type,a.is_grantable)
      FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a) AS grants
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.prokind='f' AND
      (n.nspname='inventory' OR (n.nspname='auction' AND (p.proname LIKE '%inventory%' OR p.proname='register_verified_lot'))
      OR (n.nspname='public' AND p.proname SIMILAR TO 'app_(organization_capability|provider_registry|integration_binding|integration_capability|commercial|service_marketplace)%'))
    ORDER BY 1,2`);
  const catalogHash=sha256(JSON.stringify({ rows, functions, triggers, policies, constraints, policy, columns, indexes, grants, guardFunctions, lineage }));
  const expected=process.env.PC_W1_EXPECTED_CATALOG_SHA256 ?? '';
  if (expected && (!/^[0-9a-f]{64}$/.test(expected) || expected !== catalogHash)) blocked('SCHEMA_CATALOG_MISMATCH');
  return { tables:24,structuralChecks:expected ? 'PASS' : 'OBSERVED_NOT_MATCHED',catalogHash };
}

export async function runtimeProbe(phase) {
  if (!['pre', 'post'].includes(phase)) blocked('PROBE_PHASE_INVALID');
  validateApiEnvironment(process.env);
  const manifest = decodeManifest(process.env.PC_W1_EXPECTED_MIGRATIONS_B64 ?? '');
  const require = createRequire('/app/package.json');
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({ log: [] });
  const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
  let releaseResolve, releaseReject;
  const released = new Promise((resolve, reject) => { releaseResolve = resolve; releaseReject = reject; });
  released.catch(() => {});
  input.on('line', line => line === 'finish' ? releaseResolve() : releaseReject(new Error('PROBE_CONTROL_INVALID')));
  input.on('close', () => releaseReject(new Error('PROBE_CONTROL_CLOSED')));
  try {
    await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '15000ms'");
      const principal = await tx.$queryRawUnsafe(`SELECT r.oid::integer AS oid,r.rolsuper,r.rolbypassrls,r.rolcreatedb,r.rolcreaterole,
        EXISTS(SELECT 1 FROM pg_catalog.pg_roles privileged WHERE (privileged.rolsuper OR privileged.rolbypassrls)
          AND pg_has_role(current_user,privileged.oid,'MEMBER')) AS privileged_membership
        FROM pg_catalog.pg_roles r WHERE r.rolname=current_user`);
      if (principal.length !== 1 || ['rolsuper','rolbypassrls','rolcreatedb','rolcreaterole','privileged_membership'].some(key => principal[0][key] !== false)) blocked('API_DATABASE_PRINCIPAL_NOT_CONFINED');
      const ledger = await tx.$queryRawUnsafe('SELECT migration_name,checksum,finished_at,rolled_back_at FROM public."_prisma_migrations" ORDER BY migration_name');
      let classification;
      try { classification = classifyLedger(manifest, ledger, {recognizeArchivedHistory:true}); }
      catch (error) { await attachHistoricalDiagnostics(tx, error, ledger); throw error; }
      if (phase === 'post' && classification.decision !== 'VERIFIED_ALREADY_APPLIED') blocked('POST_MIGRATION_LEDGER_INCOMPLETE');
      const lineage = await observeLineageCatalog(tx);
      const pending=classification.pendingCount!==0;
      const historical=classification.historicalLineage==='EXACT_ARCHIVE';
      if(lineage.profile!==(pending && historical ? 'HISTORICAL' : 'CANONICAL')) blocked('LINEAGE_LEDGER_CATALOG_DISAGREEMENT');
      const reference=pending ? process.env[historical ? 'PC_W1_EXPECTED_HISTORICAL_CATALOG_SHA256' : 'PC_W1_EXPECTED_BASELINE_CATALOG_SHA256'] : '';
      if(reference && (!/^[0-9a-f]{64}$/.test(reference) || reference!==lineage.catalogHash)) blocked('LINEAGE_CATALOG_REFERENCE_MISMATCH');
      const schema = await observeSchema(tx, !pending, lineage);
      const lineageChecks=(pending ? reference : process.env.PC_W1_EXPECTED_CATALOG_SHA256) ? 'PASS' : 'OBSERVED_NOT_MATCHED';
      const nonce = `pc_w1_${crypto.randomBytes(16).toString('hex')}`;
      await tx.$queryRawUnsafe("SELECT set_config('application_name',$1,true)", nonce);
      const identity = await tx.$queryRawUnsafe(`SELECT pg_backend_pid() AS pid,(SELECT oid::integer FROM pg_catalog.pg_database WHERE datname=current_database()) AS "databaseOid",
        pg_export_snapshot() AS snapshot,current_setting('transaction_read_only') AS mode,pg_is_in_recovery() AS recovery`);
      if (identity[0]?.mode !== 'on' || identity[0]?.recovery !== false) blocked('READ_ONLY_PRIMARY_REQUIRED');
      const environmentHash = sha256(JSON.stringify(sortedObject(Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('PC_W1_'))))));
      process.stdout.write(JSON.stringify({ ...identity[0], roleOid: principal[0].oid, nonce, ...classification, ...schema, environmentHash,
        historicalLineage:classification.historicalLineage ?? 'ABSENT',lineageProfile:lineage.profile,lineageCatalogHash:lineage.catalogHash,lineageChecks }) + '\n');
      const timer = setTimeout(() => releaseReject(new Error('PROBE_CONTROL_TIMEOUT')), 180_000);
      try { await released; } finally { clearTimeout(timer); }
    }, { isolationLevel: 'RepeatableRead', timeout: 200_000, maxWait: 10_000 });
    process.stdout.write('{"released":true}\n');
  } finally { input.close(); await prisma.$disconnect(); }
}

export function checkSources(root) {
  for(const [file,pins] of Object.entries(AUCTION_LINEAGE_API_BLOBS)) {
    const bytes=fs.readFileSync(path.join(root,file));
    const blob=crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    assert.equal(blob,pins.canonical,'Current auction API source requires an exact compatibility review');
  }
  const script = fs.readFileSync(path.join(root, 'scripts/production-pc-crop-w1-migrations.sh'), 'utf8');
  for (const marker of ['PC_W1_MIGRATION_DIGEST', 'snapshot-sql', 'READ_ONLY', '--snapshot=', '--format=custom',
    'PC_W1_LEGACY_LOT_ROLLBACK DEGRADED_FAIL_CLOSED', 'PC_W1_FULL_ACCEPTANCE NOT_EVIDENCED',
    'PC_W1_BASELINE_API_SHA', 'PC_W1_EXPECTED_MIGRATIONS_B64', 'MIGRATION_SERVICE_AMBIGUOUS', 'NON_API_RUNTIME_CHANGED']) {
    assert.ok(script.includes(marker), `Missing migration boundary: ${marker}`);
  }
  assert.doesNotMatch(script, /\b(?:DROP|TRUNCATE)\s+(?:TABLE|SCHEMA)|migrate\s+resolve|production-full-stack|AUTH_MAIL_PROVISION|ROLE_ELIGIBILITY_ENFORCEMENT=true/);
  assert.doesNotMatch(script, /--no-acl|--disable-triggers|--enable-row-security/);
  assert.ok(script.includes('exec 2>/dev/null'), 'Raw remote diagnostics must not become public evidence');
  const identity = 'emit PC_W1_BASELINE_API_SHA "$baseline_sha"';
  assert.equal(script.split(identity).length, 2, 'Baseline revision must be emitted exactly once');
  assert.ok(script.indexOf(identity) > script.indexOf('|| fail BASELINE_API_REVISION_INVALID')
    && script.indexOf(identity) < script.indexOf('\nprobe_open pre\n'),
  'Validated OCI revision must survive a rejected ledger probe');
  for(const [name,checksum] of HISTORICAL_MIGRATIONS) {
    assert.equal(sha256(fs.readFileSync(path.join(root,'scripts/fixtures/pc-crop-w1-lineage',`${name}.sql`))),checksum,'Archived rehearsal SQL must retain exact source bytes');
  }
  const migration=fs.readFileSync(path.join(root,'apps/api/prisma/migrations/20260909120000_reconcile_historical_auction_authority/migration.sql'),'utf8');
  assert.equal(sha256(migration),TARGET_MIGRATIONS['20260909120000_reconcile_historical_auction_authority'],'Correction must retain its reviewed checksum');
  const canonical=fs.readFileSync(path.join(root,'apps/api/prisma/migrations/20260715013100_auction_atomic_execution/migration.sql'),'utf8');
  for(const name of ['record_admission','place_bid']) {
    const declaration=canonical.slice(canonical.indexOf(`CREATE OR REPLACE FUNCTION auction.${name}(`));
    const exact=declaration.slice(0,declaration.indexOf('$function$;')+'$function$;'.length);
    assert.ok(migration.includes(exact),'Correction must preserve canonical function declarations byte for byte');
  }
  assert.doesNotMatch(migration,/\b(?:DROP|TRUNCATE)\s+(?:TABLE|SCHEMA)|\b(?:UPDATE|DELETE\s+FROM|INSERT\s+INTO)\s+(?:public\.)?"?_prisma_migrations\b/i);
  for(const key of ['PC_W1_EXPECTED_BASELINE_CATALOG_SHA256','PC_W1_EXPECTED_HISTORICAL_CATALOG_SHA256']) {
    assert.ok(script.includes(`-e ${key}`),'API probe must receive the exact rehearsal reference');
    assert.ok(script.includes(`\${${key}:-}`),'Mutation must require both rehearsal references');
  }
  const workflow=fs.readFileSync(path.join(root,'.github/workflows/pc-crop-w1-production-acceptance.yml'),'utf8');
  const routeProbe=workflow.indexOf('-- --runtime-routes');
  const deployedDigest=workflow.indexOf('PC_W1_BLOCKER=RUNNING_API_DIGEST_MISMATCH');
  const unchanged=workflow.indexOf('PC_W1_BLOCKER=API_ENV_CHANGED');
  assert.ok(deployedDigest>=0 && routeProbe>deployedDigest && routeProbe<unchanged,
    'Route probe must execute inside the verified deployed API before completion');
  for(const field of ['PC_W1_API_ROUTE_BOUNDARY=PASS','PC_W1_API_ROUTES=5']) {
    assert.ok(workflow.includes(`[[ "$OPERATION" != migrate ]] || grep -Fxq ${field} "$EVIDENCE_DIR/stage.log"`),
      'Successful migration release requires bounded route evidence');
  }
}

const args = process.argv.slice(2);
if (process.argv[1] === '--runtime-routes') {
  verifyW1RouteBoundary().then(result => {
    console.log(`PC_W1_API_ROUTE_BOUNDARY=${result.boundary}`);
    console.log(`PC_W1_API_ROUTES=${result.routes}`);
    console.log(`PC_W1_AUTHENTICATED_ACCEPTANCE=${result.authenticatedAcceptance}`);
  }).catch(error => { console.log(`PC_W1_BLOCKER=${errorCode(error)}`); process.exitCode = 1; });
} else if (process.argv[1] === '--runtime-probe') {
  runtimeProbe(process.argv[2]).catch(error => { process.stdout.write(JSON.stringify(probeErrorPayload(error)) + '\n'); process.exitCode = 1; });
} else if (process.argv[1] === '--runtime-tool' || (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)) {
  try {
    if (args[0] === 'snapshot-sql') process.stdout.write(snapshotSql(JSON.parse(fs.readFileSync(0, 'utf8'))));
    else if (args[0] === 'image-manifest') validateImageManifest(decodeManifest(process.env.PC_W1_EXPECTED_MIGRATIONS_B64 ?? ''), JSON.parse(fs.readFileSync(0, 'utf8')));
    else if (args[0] === 'verify-image-files') validateImageManifest(decodeManifest(process.env.PC_W1_EXPECTED_MIGRATIONS_B64 ?? ''), readMigrationManifest('/app/prisma/migrations'));
    else if (args[0] === 'image') validateMigrationImage(JSON.parse(fs.readFileSync(0, 'utf8'))[0], args[1], args[2]);
    else if (args[0] === 'compose') process.stdout.write(validateCompose(JSON.parse(fs.readFileSync(0, 'utf8'))));
    else if (args[0] === 'runtime-fingerprint') process.stdout.write(runtimeFingerprint(JSON.parse(fs.readFileSync(0, 'utf8')), args[1]));
    else if (args[0] === 'probe-error') {
      const value=JSON.parse(fs.readFileSync(0,'utf8'));
      if(value.error) process.stdout.write(SAFE_ERROR.test(value.error) ? value.error : 'UNCLASSIFIED_PROBE_FAILURE');
    }
    else if (args[0] === 'probe-diagnostics') process.stdout.write(probeDiagnostics(JSON.parse(fs.readFileSync(0,'utf8'))));
    else if (args[0] === 'evidence') { parseEvidence(fs.readFileSync(0, 'utf8')); console.log('PC_W1_EVIDENCE_CONTRACT=PASS'); }
    else if (args[0] === 'lineage-source-compatibility') {
      verifyLineageSourceCompatibility(process.cwd(),process.env.BASELINE_SHA,process.env.TARGET_SHA);
      console.log('PC_W1_LINEAGE_SOURCE_COMPATIBILITY=PASS');
    }
    else if (args[0] === 'probe-field') {
      const value = validateSnapshot(JSON.parse(fs.readFileSync(0, 'utf8')));
      if (!['snapshot','decision','pendingCount','tables','structuralChecks','catalogHash','environmentHash','legacyInitialMarker',
        'historicalLineage','lineageProfile','lineageCatalogHash','lineageChecks'].includes(args[1])) blocked('PROBE_FIELD_INVALID');
      process.stdout.write(String(value[args[1]] ?? ''));
    } else { checkSources(args[0] ?? process.cwd()); console.log('PC_W1_SOURCE_CONTRACT=PASS'); }
  } catch (error) { console.error(errorCode(error)); process.exitCode = 1; }
}
