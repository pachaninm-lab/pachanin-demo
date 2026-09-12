import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { checkManifests } from './check-ci-postgres-image-authority.mjs';
import { TARGET_MIGRATIONS, TARGET_TABLES, readMigrationManifest, validateManifest, decodeManifest, validateImageManifest,
  classifyLedger, HISTORICAL_MIGRATIONS, HISTORICAL_FUNCTIONS, attachHistoricalDiagnostics, observeLineageCatalog, verifyLineageSourceCompatibility, validateApiEnvironment, validateSnapshot, snapshotSql, parseEvidence,
  validateMigrationImage, validateCompose, runtimeFingerprint, runtimeDiff, runtimeDiffEvidence, errorCode, probeErrorPayload, probeDiagnostics, ledgerDiagnostics, checkSources,
  verifyW1RouteBoundary, AUCTION_LINEAGE_API_BLOBS, validateAuctionLineageApiBlobs } from './check-production-pc-crop-w1-acceptance.mjs';

const baseName='20260902204500_role_eligibility_app_deal_api_boundary';
const manifest={ [baseName]:'a'.repeat(64), ...TARGET_MIGRATIONS };
const finished=name=>({ migration_name:name,checksum:manifest[name],finished_at:'2026-09-08T00:00:00Z',rolled_back_at:null });
const target='a'.repeat(40),digest=`ghcr.io/pachaninm-lab/grainflow-migration@sha256:${'b'.repeat(64)}`;
const clone=value=>structuredClone(value);
const rejects=(fn,code)=>assert.throws(fn,error=>error.message===code);
const pre=()=>({ snapshot:'00000003-000001AB-1',nonce:`pc_w1_${'c'.repeat(32)}`,pid:12,databaseOid:42,roleOid:16384,
  decision:'READY_EXACT_EIGHT',pendingCount:8,legacyInitialMarker:'ABSENT',tables:0,structuralChecks:'NOT_APPLIED',environmentHash:'d'.repeat(64),
  historicalLineage:'ABSENT',lineageProfile:'CANONICAL',lineageCatalogHash:'e'.repeat(64),lineageChecks:'PASS' });
const environment=()=>({ NODE_ENV:'production', ...Object.fromEntries(['DEAL','DOCUMENT','SHIPMENT','LAB','PAYMENT'].map(name=>[`PLATFORM_V7_${name}_REPOSITORY`,'prisma'])) });
const image=()=>({ Id:`sha256:${'e'.repeat(64)}`,RepoDigests:[digest],Config:{User:'nonroot',WorkingDir:'/app',Entrypoint:['/nodejs/bin/node'],
  Cmd:['node_modules/prisma/build/index.js','migrate','deploy','--schema','prisma/schema.prisma'],Labels:{'org.opencontainers.image.revision':target}} });
const compose=()=>({ services:{api:{image:'api'},migration:{image:digest,environment:{DATABASE_URL:'postgresql://isolated.invalid/test'}}} });
const container=(id='f')=>({ Id:id.repeat(64),Image:`sha256:${'a'.repeat(64)}`,State:{Running:true,StartedAt:'2026-09-08T00:00:00Z'},
  Config:{Env:['NODE_ENV=production'],Cmd:['worker'],Labels:{'com.docker.compose.service':'worker'}},HostConfig:{},Mounts:[],NetworkSettings:{Networks:{isolated:{NetworkID:'n',EndpointID:'e',IPAddress:'172.25.0.2'}}} });
const readyEvidence=()=>({PC_W1_LEGACY_INITIAL_MARKER:'ABSENT',PC_W1_TARGET_SHA:target,PC_W1_BASELINE_API_SHA:'b'.repeat(40),PC_W1_DATABASE_IDENTITY:'PASS',
  PC_W1_PENDING_MIGRATIONS:'8',PC_W1_SCHEMA_TABLES:'0',PC_W1_SCHEMA_STRUCTURAL_CHECKS:'NOT_APPLIED',
  PC_W1_ARCHIVED_LEDGER:'ABSENT',PC_W1_LINEAGE_PROFILE:'CANONICAL',PC_W1_LINEAGE_CHECKS:'PASS',PC_W1_LINEAGE_CATALOG_SHA256:'e'.repeat(64),
  PC_W1_API_ENVIRONMENT_SHA256:'c'.repeat(64),PC_W1_NON_API_RUNTIME_SHA256:'d'.repeat(64),PC_W1_RUNTIME_UNCHANGED:'PASS',
  PC_W1_DATABASE_ROLLBACK:'NOT_REHEARSED',PC_W1_DATABASE_MUTATION:'NONE',PC_W1_AUTHENTICATED_ACCEPTANCE:'NOT_EVIDENCED',
  PC_W1_FULL_ACCEPTANCE:'NOT_EVIDENCED',PC_W1_LEGACY_LOT_ROLLBACK:'DEGRADED_FAIL_CLOSED',PC_W1_RESULT:'READY_EXACT_EIGHT'});
const lines=value=>Object.entries(value).map(([key,value])=>`${key}=${value}`).join('\n');

test('W1 route probe uses real HTTP, tests absent and malformed credentials, and never claims business acceptance',async t=>{
  const requests=[];
  let fault;
  const server=createServer((req,res)=>{
    requests.push({path:req.url,method:req.method,authorization:req.headers.authorization});
    const status=req.url==='/ready' ? 200 : req.url.startsWith('/api/pc-crop-w1-absent-') ? 404 : 401;
    if(fault==='redirect') {res.writeHead(302,{location:'/ready'});res.end();return;}
    res.writeHead(fault==='blanket401' ? 401 : fault==='missingRoute' && req.url==='/api/commercial-rules/me' ? 404
      : fault==='publicRoute' && req.url==='/api/service-marketplace/me' ? 200
      : fault==='acceptInvalid' && req.headers.authorization ? 200 : status);
    res.end('This local test response must not enter evidence.');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const request=(url,options)=>{
    assert.equal(new URL(url).origin,'http://127.0.0.1:3001','Runtime target cannot be caller supplied');
    return fetch(`http://127.0.0.1:${server.address().port}${new URL(url).pathname}`,options);
  };
  assert.deepEqual(await verifyW1RouteBoundary(request),{routes:5,boundary:'PASS',authenticatedAcceptance:'NOT_EVIDENCED'});
  assert.equal(requests.length,12);
  assert.ok(requests.every(req=>req.method==='GET'));
  const protectedRequests=requests.slice(2);
  assert.equal(new Set(protectedRequests.map(req=>req.path)).size,5);
  assert.equal(protectedRequests.filter(req=>req.authorization===undefined).length,5);
  assert.equal(protectedRequests.filter(req=>req.authorization==='Bearer pc-w1-invalid-credentials').length,5);
  for(fault of ['blanket401','missingRoute','publicRoute','acceptInvalid']) {
    await assert.rejects(verifyW1RouteBoundary(request),{message:'API_ROUTE_BOUNDARY_FAILED'});
  }
  fault='redirect';
  await assert.rejects(verifyW1RouteBoundary(request),{message:'API_ROUTE_TRANSPORT_FAILED'});
  await assert.rejects(verifyW1RouteBoundary(async()=>{throw Error('private connection details');}),{message:'API_ROUTE_TRANSPORT_FAILED'});
});

test('W1 route probe cancels response bodies without reading tenant data',async()=>{
  let count=0;
  const request=async(url,options)=>{
    assert.equal(options.redirect,'error');assert.ok(options.signal instanceof AbortSignal);
    const route=new URL(url).pathname;
    return {status:route==='/ready'?200:route.startsWith('/api/pc-crop-w1-absent-')?404:401,
      body:{cancel:async()=>{count++;}},text:()=>assert.fail('Response body must not be read')};
  };
  await verifyW1RouteBoundary(request);
  assert.equal(count,12);
});

test('lineage compatibility uses actual baseline Git blobs and blocks legacy consumers or changed callers',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'w1-lineage-source-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const git=args=>{const r=spawnSync('git',args,{cwd:root,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
  const write=(file,content)=>{fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),content);};
  git(['init','--initial-branch=main']);git(['config','user.name','Isolated Source Test']);git(['config','user.email','test@example.invalid']);
  const caller='apps/api/src/modules/deals/industrial-deal-command.gateway.ts';
  for(const file of [caller,'apps/api/src/modules/auctions/auctions.module.ts','apps/api/src/modules/deals/prisma-deal.repository.ts',
    'apps/api/src/common/prisma/rls-transaction.service.ts']) write(file,'export const caller = true;\n');
  for(const file of Object.keys(AUCTION_LINEAGE_API_BLOBS)) write(file,fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8'));
  git(['add','.']);git(['commit','-m','isolated baseline']);const baseline=git(['rev-parse','HEAD']);
  write('README.md','Unrelated change\n');git(['add','.']);git(['commit','-m','isolated target']);const target=git(['rev-parse','HEAD']);
  assert.equal(verifyLineageSourceCompatibility(root,baseline,target),'PASS');
  rejects(()=>verifyLineageSourceCompatibility(root,target,baseline),'LINEAGE_BASELINE_NOT_ANCESTOR');
  const commands='apps/api/src/modules/auctions/auction-command.service.ts';
  write(commands,fs.readFileSync(new URL(`../${commands}`,import.meta.url),'utf8')+'\n// Changed caller\n');
  git(['add','.']);git(['commit','-m','unreviewed direct SQL caller']);
  rejects(()=>verifyLineageSourceCompatibility(root,baseline,git(['rev-parse','HEAD'])),'AUCTION_LINEAGE_API_COMPATIBILITY_UNPROVEN');
  write(commands,fs.readFileSync(new URL(`../${commands}`,import.meta.url),'utf8'));
  write('apps/api/src/extra-caller.ts','export const query = "SELECT auction.place_bid()";\n');
  git(['add','.']);git(['commit','-m','additional SQL consumer']);
  rejects(()=>verifyLineageSourceCompatibility(root,baseline,git(['rev-parse','HEAD'])),'AUCTION_LINEAGE_SQL_CONSUMERS_UNEXPECTED');
  fs.unlinkSync(path.join(root,'apps/api/src/extra-caller.ts'));
  write(caller,'export const caller = false;\n');git(['add','.']);git(['commit','-m','changed caller']);
  rejects(()=>verifyLineageSourceCompatibility(root,baseline,git(['rev-parse','HEAD'])),'LINEAGE_CALLER_COMPATIBILITY_UNPROVEN');
  write('apps/api/src/legacy.ts','export const query = "SELECT dealx.participant_tenant()";\n');git(['add','.']);git(['commit','-m','legacy consumer']);
  const legacy=git(['rev-parse','HEAD']);
  rejects(()=>verifyLineageSourceCompatibility(root,baseline,legacy),'LEGACY_SQL_HELPER_CONSUMER_PRESENT');
  fs.unlinkSync(path.join(root,'apps/api/src/legacy.ts'));git(['add','.']);git(['commit','-m','remove target consumer']);
  rejects(()=>verifyLineageSourceCompatibility(root,legacy,git(['rev-parse','HEAD'])),'LEGACY_SQL_HELPER_CONSUMER_PRESENT');
});

test('auction source compatibility admits only audited old or current callers toward the current API',()=>{
  const old=Object.fromEntries(Object.entries(AUCTION_LINEAGE_API_BLOBS).map(([file,pins])=>[file,pins.historical]));
  const current=Object.fromEntries(Object.entries(AUCTION_LINEAGE_API_BLOBS).map(([file,pins])=>[file,pins.canonical]));
  validateAuctionLineageApiBlobs(old,current);
  validateAuctionLineageApiBlobs(current,current);
  rejects(()=>validateAuctionLineageApiBlobs(current,old),'AUCTION_LINEAGE_API_COMPATIBILITY_UNPROVEN');
  rejects(()=>validateAuctionLineageApiBlobs({},current),'AUCTION_LINEAGE_API_SOURCE_UNAVAILABLE');
  const file=Object.keys(current)[0];
  rejects(()=>validateAuctionLineageApiBlobs({...old,[file]:'a'.repeat(40)},current),'AUCTION_LINEAGE_API_COMPATIBILITY_UNPROVEN');
});

function canonicalLineageRows() {
  const sql=fs.readFileSync(new URL('../apps/api/prisma/migrations/20260715013100_auction_atomic_execution/migration.sql',import.meta.url),'utf8');
  const functions=['record_admission','place_bid'].map(name=>{
    const declaration=sql.slice(sql.indexOf(`CREATE OR REPLACE FUNCTION auction.${name}(`));
    const body=declaration.split('AS $function$')[1].split('$function$;')[0];
    return {name:`auction.${name}`,body,owner:'MIGRATION_OWNER',definer:true,config:['search_path=pg_catalog, public, auction'],
      grants:[{grantee:'app_deal',privilege:'EXECUTE',grantable:false}]};
  });
  return [functions,[{relation:'auction.lots',policyname:'tenant_policy',qual:'tenant_id = current_tenant',roles:['public']}],
    ['admissions','awards','bids','lots'].map(name=>({name:`auction.${name}`,rls:true,force:true,active:true,owner:'MIGRATION_OWNER'})),[]];
}
const readLineage=rows=>{let index=0;return observeLineageCatalog({$queryRawUnsafe:async()=>clone(rows[index++])});};
test('lineage catalog fingerprints policy predicates and grants independently of function-body labels',async()=>{
  const rows=canonicalLineageRows(),expected=await readLineage(rows);
  assert.equal(expected.profile,'CANONICAL');
  assert.match(expected.catalogHash,/^[0-9a-f]{64}$/);
  for(const mutate of [r=>{r[1][0].qual='true';},r=>{r[0][0].grants.push({grantee:'PUBLIC',privilege:'EXECUTE',grantable:false});}]) {
    const changed=clone(rows);mutate(changed);
    const observed=await readLineage(changed);
    assert.equal(observed.profile,'CANONICAL');
    assert.notEqual(observed.catalogHash,expected.catalogHash,'Body equality cannot hide altered policy or grant authority');
  }
});
test('lineage observation rejects overloads, unrecognized bodies, incomplete tables and non-forced RLS',async()=>{
  for(const [mutate,code] of [
    [r=>r[0].push(clone(r[0][0])),'LINEAGE_FUNCTION_OVERLOAD_UNEXPECTED'],
    [r=>{r[0][0].body='BEGIN RETURN NULL; END';},'LINEAGE_PROFILE_UNRECOGNIZED'],
    [r=>r[2].pop(),'LINEAGE_CATALOG_INVALID'],
    [r=>{r[2][0].force=false;},'LINEAGE_CATALOG_INVALID'],
    [r=>{r[1]=Array.from({length:65},()=>r[1][0]);},'LINEAGE_CATALOG_INVALID'],
  ]) {
    const rows=canonicalLineageRows();mutate(rows);
    await assert.rejects(readLineage(rows),error=>error.message===code);
  }
});

test('only seven foundation migrations and the pinned correction may be pending',()=>{
  assert.equal(Object.keys(TARGET_MIGRATIONS).length,8);
  assert.equal(TARGET_TABLES.length,24);
  assert.deepEqual(classifyLedger(manifest,[finished(baseName)]),{decision:'READY_EXACT_EIGHT',pendingCount:8,legacyInitialMarker:'ABSENT'});
  assert.deepEqual(classifyLedger(manifest,Object.keys(manifest).map(finished)),{decision:'VERIFIED_ALREADY_APPLIED',pendingCount:0,legacyInitialMarker:'ABSENT'});
});
for(const name of Object.keys(TARGET_MIGRATIONS)) test(`partial applied set blocks: ${name}`,()=>{
  rejects(()=>classifyLedger(manifest,[finished(baseName),finished(name)]),'PENDING_SET_NOT_EXACT_EIGHT');
});
test('an extra pending migration cannot ride along with the accepted eight',()=>{
  rejects(()=>classifyLedger({...manifest,'20260909000000_unaccepted_change':'1'.repeat(64)},[finished(baseName)]),'PENDING_SET_NOT_EXACT_EIGHT');
});
test('older missing migration blocks too',()=>rejects(()=>classifyLedger(manifest,[]),'PENDING_SET_NOT_EXACT_EIGHT'));
test('the exact historical auxiliary marker requires a separate canonical execution row in either order',()=>{
  const actual=readMigrationManifest(fileURLToPath(new URL('../apps/api/prisma/migrations',import.meta.url)));
  const initial='0001_postgresql_initial';
  const rows=Object.entries(actual).filter(([name])=>!Object.hasOwn(TARGET_MIGRATIONS,name)).map(([migration_name,checksum])=>({migration_name,checksum,finished_at:'2026-09-08',rolled_back_at:null}));
  const marker={migration_name:initial,checksum:'grainflow_v3_initial_postgresql',finished_at:'2026-09-08',rolled_back_at:null};
  const before=clone(rows);
  for(const ledger of [[marker,...rows],[...rows,marker]]) assert.deepEqual(classifyLedger(actual,ledger),{
    decision:'READY_EXACT_EIGHT',pendingCount:8,legacyInitialMarker:'REDUNDANT_SOURCE_MARKER'});
  assert.deepEqual(rows,before);
  const full=[...Object.entries(actual).map(([migration_name,checksum])=>({migration_name,checksum,finished_at:'2026-09-08',rolled_back_at:null})),marker];
  assert.deepEqual(classifyLedger(actual,full),{decision:'VERIFIED_ALREADY_APPLIED',pendingCount:0,legacyInitialMarker:'REDUNDANT_SOURCE_MARKER'});
  const badCases=[
    [actual,[marker,...rows.filter(row=>row.migration_name!==initial)]],
    [actual,[marker,...rows.map(row=>row.migration_name===initial?{...row,checksum:'0'.repeat(64)}:row)]],
    [actual,[marker,marker,...rows]],
    [actual,[marker,...rows,rows.find(row=>row.migration_name===initial)]],
    [actual,[{...marker,checksum:'other_marker'},...rows]],
    [{...actual,[initial]:'0'.repeat(64)},[marker,...rows.map(row=>row.migration_name===initial?{...row,checksum:'0'.repeat(64)}:row)]],
    [actual,[marker,...rows.map(row=>row.migration_name===initial?{...row,rolled_back_at:'2026-09-09'}:row)]],
    [actual,[{...marker,finished_at:null},...rows]],
    [actual,[marker,...rows, {...marker,migration_name:'0002_other_initial'}]],
  ];
  for(const [m,ledger] of badCases) assert.throws(()=>classifyLedger(m,ledger),/APPLIED_MIGRATION_CHECKSUM_DRIFT|DUPLICATE_APPLIED_MIGRATION|UNFINISHED_MIGRATION|UNRECOGNIZED_APPLIED_MIGRATION/);
});
test('successful transport and evidence must disclose how the historical marker was treated',()=>{
  const source=fs.readFileSync(new URL('./check-production-pc-crop-w1-acceptance.mjs',import.meta.url),'utf8');
  for(const legacyInitialMarker of ['ABSENT','REDUNDANT_SOURCE_MARKER']) {
    const snapshot={...pre(),legacyInitialMarker};
    assert.equal(validateSnapshot(snapshot).legacyInitialMarker,legacyInitialMarker);
    const transported=spawnSync(process.execPath,['--input-type=module','-e',source,'--','--runtime-tool','probe-field','legacyInitialMarker'],{input:JSON.stringify(snapshot),encoding:'utf8'});
    assert.equal(transported.status,0);assert.equal(transported.stdout,legacyInitialMarker);
    assert.equal(parseEvidence(lines({...readyEvidence(),PC_W1_LEGACY_INITIAL_MARKER:legacyInitialMarker})).PC_W1_LEGACY_INITIAL_MARKER,legacyInitialMarker);
  }
  const missing=pre();delete missing.legacyInitialMarker;
  rejects(()=>validateSnapshot(missing),'INITIAL_MARKER_EVIDENCE_MISSING');
  const evidence=readyEvidence();delete evidence.PC_W1_LEGACY_INITIAL_MARKER;
  rejects(()=>parseEvidence(lines(evidence)),'INCOMPLETE_REMOTE_EVIDENCE');
});
test('unfinished migration blocks even with all successful migrations present',()=>{
  rejects(()=>classifyLedger(manifest,[...Object.keys(manifest).map(finished),{migration_name:'unknown',finished_at:null,rolled_back_at:null}]),'UNFINISHED_MIGRATION');
});
test('unrecognized successful and duplicate successful migration ledger rows block',()=>{
  rejects(()=>classifyLedger(manifest,[finished('20260909000000_unaccepted_change')]),'UNRECOGNIZED_APPLIED_MIGRATION');
  rejects(()=>classifyLedger(manifest,[finished(baseName),finished(baseName)]),'DUPLICATE_APPLIED_MIGRATION');
});
test('historical applied checksum drift blocks before migration',()=>{
  rejects(()=>classifyLedger(manifest,[{...finished(baseName),checksum:'0'.repeat(64)}]),'APPLIED_MIGRATION_CHECKSUM_DRIFT');
});
test('checksum drift emits only an identifiable migration fingerprint and the two checksum values',()=>{
  let failure;
  try {classifyLedger(manifest,[{...finished(baseName),checksum:'0'.repeat(64)}]);}catch(error){failure=error;}
  const payload=probeErrorPayload(failure);
  assert.equal(payload.error,'APPLIED_MIGRATION_CHECKSUM_DRIFT');
  assert.deepEqual(payload.checksumDrift,{
    migrationSha256:crypto.createHash('sha256').update(baseName).digest('hex'),expectedSha256:manifest[baseName],appliedSha256:'0'.repeat(64),
    appliedValueSha256:crypto.createHash('sha256').update(JSON.stringify('0'.repeat(64))).digest('hex')});
  assert.equal(payload.ledgerDiagnostics.DRIFTED,1);
  const output=probeDiagnostics(payload);
  assert.doesNotMatch(output,/migration_name|postgresql:|secret|20260902204500/);
  const evidence=output+'PC_W1_ERROR=APPLIED_MIGRATION_CHECKSUM_DRIFT\nPC_W1_DATABASE_MUTATION=NONE\nPC_W1_RESULT=BLOCKED\n';
  assert.equal(parseEvidence(evidence).PC_W1_CHECKSUM_DRIFT_APPLIED_SHA256,'0'.repeat(64));
  const source=fs.readFileSync(new URL('./check-production-pc-crop-w1-acceptance.mjs',import.meta.url),'utf8');
  const transported=spawnSync(process.execPath,['--input-type=module','-e',source,'--','--runtime-tool','probe-diagnostics'],{input:JSON.stringify(payload),encoding:'utf8'});
  assert.equal(transported.status,0);assert.equal(transported.stdout,output);assert.equal(transported.stderr,'');
  rejects(()=>parseEvidence(output+lines(readyEvidence())),'CONTRADICTORY_CHECKSUM_DIAGNOSTICS');
});
test('whole-ledger diagnostics identify the source marker and every class without admitting any drift',()=>{
  const initial='0001_postgresql_initial';
  const m={...manifest,[initial]:'b'.repeat(64)};
  const row=(name,checksum)=>({migration_name:name,checksum,finished_at:'2026-09-08',rolled_back_at:null});
  const ledger=[row(initial,'grainflow_v3_initial_postgresql'),finished(baseName),finished(baseName),row(baseName,'c'.repeat(64)),
    row('unknown_name','a'.repeat(64)),{...finished(baseName),finished_at:null},{...finished(baseName),rolled_back_at:'2026-09-09'}];
  const d=ledgerDiagnostics(m,ledger);
  assert.deepEqual({...d,unknownMigrations:undefined,SHA256:'HASH'},{ROWS:7,MATCHED:2,DRIFTED:2,UNKNOWN:1,DUPLICATES:2,UNFINISHED:1,ROLLED_BACK:1,LEGACY_INITIAL_MARKERS:1,unknownMigrations:undefined,SHA256:'HASH'});
  assert.equal(d.SHA256,ledgerDiagnostics(m,[...ledger].reverse()).SHA256);
  assert.notEqual(d.SHA256,ledgerDiagnostics(m,ledger.slice(1)).SHA256);
  rejects(()=>classifyLedger(m,ledger),'UNFINISHED_MIGRATION');
  rejects(()=>classifyLedger(m,ledger.filter(row=>row.finished_at!=null)),'APPLIED_MIGRATION_CHECKSUM_DRIFT');
  assert.equal(ledgerDiagnostics(m,[row(initial,'other_bad_value')]).LEGACY_INITIAL_MARKERS,0);
  const real=fs.readFileSync(new URL('../apps/api/prisma/migrations/0001_postgresql_initial/migration.sql',import.meta.url),'utf8');
  assert.match(real,/'grainflow_v3_initial_postgresql'/);
});
test('ledger diagnostics reject partial, contradictory and unbounded output and disclose no raw values',()=>{
  let error;
  try {classifyLedger(manifest,[{...finished(baseName),checksum:'private-value'}]);}catch(e){error=e;}
  const payload=probeErrorPayload(error),output=probeDiagnostics(payload);
  const end='PC_W1_ERROR=APPLIED_MIGRATION_CHECKSUM_DRIFT\nPC_W1_DATABASE_MUTATION=NONE\nPC_W1_RESULT=BLOCKED\n';
  assert.doesNotMatch(output,/private-value|migration_name|finished_at/);
  assert.equal(parseEvidence(output+end).PC_W1_LEDGER_ROWS,'1');
  for(const [key,value] of Object.entries(payload.ledgerDiagnostics).filter(([key])=>key!=='unknownMigrations')) {
    const changed=structuredClone(payload);changed.ledgerDiagnostics[key]=key==='SHA256'?'secret-path':10001;
    assert.equal(probeErrorPayload({message:changed.error,...changed}).ledgerDiagnostics,undefined);
    rejects(()=>parseEvidence(output.replace(`PC_W1_LEDGER_${key}=${value}\n`,'')+end),'CONTRADICTORY_LEDGER_DIAGNOSTICS');
  }
  rejects(()=>parseEvidence(output.replace('PC_W1_LEDGER_ROWS=1','PC_W1_LEDGER_ROWS=2')+end),'CONTRADICTORY_LEDGER_DIAGNOSTICS');
  rejects(()=>parseEvidence(output+end.replace('MUTATION=NONE','MUTATION=BOUNDED_EIGHT_MIGRATIONS')),'CONTRADICTORY_LEDGER_DIAGNOSTICS');
  rejects(()=>parseEvidence(output+'PC_W1_RESULT=READY_EXACT_EIGHT\n'),'CONTRADICTORY_CHECKSUM_DIAGNOSTICS');
  const changed=structuredClone(payload);changed.checksumDrift.appliedValueSha256='private-value';
  assert.doesNotMatch(probeDiagnostics(changed),/private-value/);
});
test('all ledger blockers transport complete diagnostics regardless of first anomaly ordering',()=>{
  const wrong={...finished(baseName),checksum:'private-drift'};
  for(const [code,ledger] of [
    ['UNFINISHED_MIGRATION',[wrong,{...finished(baseName),finished_at:null}]],
    ['DUPLICATE_APPLIED_MIGRATION',[finished(baseName),finished(baseName),wrong]],
    ['UNRECOGNIZED_APPLIED_MIGRATION',[{...finished(baseName),migration_name:'private-unknown'},wrong]],
    ['PENDING_SET_NOT_EXACT_EIGHT',[]],
    ['APPLIED_MIGRATION_CHECKSUM_DRIFT',[wrong,finished(baseName),finished(baseName)]],
  ]) {
    let error;try {classifyLedger(manifest,ledger);}catch(e){error=e;}
    assert.equal(error.message,code);
    const payload=probeErrorPayload(error),output=probeDiagnostics(payload);
    assert.equal(payload.ledgerDiagnostics.ROWS,ledger.length);
    assert.doesNotMatch(output,/private-drift|private-unknown/);
    const evidence=output+`PC_W1_ERROR=${code}\nPC_W1_DATABASE_MUTATION=NONE\nPC_W1_RESULT=BLOCKED\n`;
    assert.equal(parseEvidence(evidence).PC_W1_LEDGER_ROWS,String(ledger.length));
    rejects(()=>parseEvidence(`PC_W1_ERROR=${code}\nPC_W1_DATABASE_MUTATION=NONE\nPC_W1_RESULT=BLOCKED\n`),'CONTRADICTORY_LEDGER_DIAGNOSTICS');
    rejects(()=>parseEvidence(evidence.split('\n').filter(line=>!line.startsWith('PC_W1_LEDGER_')).join('\n')),'CONTRADICTORY_LEDGER_DIAGNOSTICS');
    const source=fs.readFileSync(new URL('./check-production-pc-crop-w1-acceptance.mjs',import.meta.url),'utf8');
    const transport=spawnSync(process.execPath,['--input-type=module','-e',source,'--','--runtime-tool','probe-diagnostics'],{input:JSON.stringify(payload),encoding:'utf8'});
    assert.equal(transport.status,0);assert.equal(transport.stdout,output);assert.equal(transport.stderr,'');
    rejects(()=>parseEvidence(evidence.replace(`PC_W1_ERROR=${code}`,'PC_W1_ERROR=UNRELATED_FAILURE')),code==='APPLIED_MIGRATION_CHECKSUM_DRIFT'?'CONTRADICTORY_CHECKSUM_DIAGNOSTICS':'CONTRADICTORY_LEDGER_DIAGNOSTICS');
    assert.equal(probeDiagnostics({...payload,error:'UNRELATED_FAILURE'}),'');
  }
});
test('unknown migration fingerprints identify every observed row without disclosing names or arbitrary values',()=>{
  const unknown=Array.from({length:4},(_,index)=>({...finished(baseName),migration_name:`private-name-${index}`,checksum:index===0?'private-value':'b'.repeat(64)}));
  let error;try {classifyLedger(manifest,unknown);}catch(e){error=e;}
  const payload=probeErrorPayload(error),output=probeDiagnostics(payload);
  const end='PC_W1_ERROR=UNRECOGNIZED_APPLIED_MIGRATION\nPC_W1_DATABASE_MUTATION=NONE\nPC_W1_RESULT=BLOCKED\n';
  assert.equal(payload.ledgerDiagnostics.unknownMigrations.length,4);
  assert.doesNotMatch(output,/private-name|private-value|unknownMigrations|\[object/);
  assert.equal(parseEvidence(output+end).PC_W1_UNKNOWN_DETAILS_COUNT,'4');
  assert.equal(payload.ledgerDiagnostics.unknownMigrations[0].nameSha256.length,64);
  for(const line of output.split('\n').filter(line=>line.startsWith('PC_W1_UNKNOWN_'))) {
    rejects(()=>parseEvidence(output.replace(line+'\n','')+end),'INCOMPLETE_UNKNOWN_MIGRATION_DIAGNOSTICS');
  }
  rejects(()=>parseEvidence(output.split('\n').filter(line=>!line.startsWith('PC_W1_UNKNOWN_')).join('\n')+end),'INCOMPLETE_UNKNOWN_MIGRATION_DIAGNOSTICS');
  for(const key of ['nameSha256','checksumSha256','valueSha256']) {
    const invalid=clone(payload);invalid.ledgerDiagnostics.unknownMigrations[0][key]='private-value';
    assert.equal(probeDiagnostics(invalid),'');
  }
  const swapped=clone(payload);swapped.ledgerDiagnostics.unknownMigrations.pop();assert.equal(probeDiagnostics(swapped),'');
  assert.deepEqual(ledgerDiagnostics(manifest,[...unknown].reverse()),ledgerDiagnostics(manifest,unknown));
});
test('unknown detail output is bounded and cannot claim complete coverage beyond 32 records',()=>{
  const rows=Array.from({length:33},(_,index)=>({...finished(baseName),migration_name:`unknown-${index}`}));
  let error;try{classifyLedger(manifest,rows);}catch(e){error=e;}
  const payload=probeErrorPayload(error),output=probeDiagnostics(payload);
  const evidence=parseEvidence(output+'PC_W1_ERROR=UNRECOGNIZED_APPLIED_MIGRATION\nPC_W1_DATABASE_MUTATION=NONE\nPC_W1_RESULT=BLOCKED\n');
  assert.equal(evidence.PC_W1_LEDGER_UNKNOWN,'33');assert.equal(evidence.PC_W1_UNKNOWN_DETAILS_COUNT,'32');
  assert.equal(payload.ledgerDiagnostics.unknownMigrations.length,32);
  assert.ok(output.length<12000);
});
const historicalLedger = () => HISTORICAL_MIGRATIONS.map(([migration_name,checksum]) =>
  ({migration_name,checksum,finished_at:'2026-07-18T00:00:00Z',rolled_back_at:null}));
test('explicit historical classification retains all four exact archival rows and the exact eight pending set',()=>{
  const rows=[finished(baseName),...historicalLedger()],before=JSON.stringify(rows);
  const result=classifyLedger(manifest,rows,{recognizeArchivedHistory:true});
  assert.deepEqual(result,{decision:'READY_EXACT_EIGHT',pendingCount:8,legacyInitialMarker:'ABSENT',historicalLineage:'EXACT_ARCHIVE'});
  assert.equal(JSON.stringify(rows),before);
  const applied=classifyLedger(manifest,[...Object.keys(manifest).map(finished),...historicalLedger()],{recognizeArchivedHistory:true});
  assert.equal(applied.decision,'VERIFIED_ALREADY_APPLIED');assert.equal(applied.historicalLineage,'EXACT_ARCHIVE');
  for(const mutate of [r=>r.pop(),r=>r.push(clone(r[1])),r=>{r[1].checksum='f'.repeat(64);},
    r=>{r[1].rolled_back_at='2026-09-09';}]) {
    const invalid=clone(rows);mutate(invalid);
    rejects(()=>classifyLedger(manifest,invalid,{recognizeArchivedHistory:true}),'ARCHIVED_MIGRATION_SET_INVALID');
  }
  rejects(()=>classifyLedger(manifest,[...rows,{migration_name:'20260909000100_unknown',checksum:'f'.repeat(64),finished_at:'2026-09-09',rolled_back_at:null}],
    {recognizeArchivedHistory:true}),'UNRECOGNIZED_APPLIED_MIGRATION');
  rejects(()=>classifyLedger(manifest,[...rows,finished(Object.keys(TARGET_MIGRATIONS)[0])],{recognizeArchivedHistory:true}),'PENDING_SET_NOT_EXACT_EIGHT');
  const missing={...manifest};delete missing['20260909120000_reconcile_historical_auction_authority'];
  rejects(()=>classifyLedger(missing,rows,{recognizeArchivedHistory:true}),'ACCEPTED_MIGRATION_CHECKSUM_MISMATCH');
});
test('archived source can never be inserted into the deployable migration manifest',()=>{
  for(const [name,checksum] of HISTORICAL_MIGRATIONS) rejects(()=>validateManifest({...manifest,[name]:checksum}),'ARCHIVED_SQL_IN_MIGRATION_DIRECTORY');
});
test('complete lineage evidence is required and catalog-only observation is not mutation admission',()=>{
  const ready=readyEvidence();
  for(const key of ['PC_W1_ARCHIVED_LEDGER','PC_W1_LINEAGE_PROFILE','PC_W1_LINEAGE_CHECKS','PC_W1_LINEAGE_CATALOG_SHA256']) {
    const missing=clone(ready);delete missing[key];rejects(()=>parseEvidence(lines(missing)),'INCOMPLETE_REMOTE_EVIDENCE');
  }
  rejects(()=>parseEvidence(lines({...ready,PC_W1_ARCHIVED_LEDGER:'EXACT_ARCHIVE'})),'CONTRADICTORY_LINEAGE_EVIDENCE');
  const observed={...ready,PC_W1_ARCHIVED_LEDGER:'EXACT_ARCHIVE',PC_W1_LINEAGE_PROFILE:'HISTORICAL',PC_W1_LINEAGE_CHECKS:'OBSERVED_NOT_MATCHED'};
  assert.equal(parseEvidence(lines(observed)).PC_W1_FULL_ACCEPTANCE,'NOT_EVIDENCED');
  rejects(()=>parseEvidence(lines({...observed,PC_W1_LINEAGE_PROFILE:'CANONICAL',PC_W1_RESULT:'MIGRATIONS_APPLIED_PENDING_API_ACCEPTANCE'})),'LINEAGE_REFERENCE_REQUIRED');
});
const unknownError = ledger => { try { classifyLedger(manifest,ledger); } catch(error) { return error; } assert.fail('Expected ledger blocker'); };
const historicalTerminal = 'PC_W1_ERROR=UNRECOGNIZED_APPLIED_MIGRATION\nPC_W1_DATABASE_MUTATION=NONE\nPC_W1_RESULT=BLOCKED\n';
test('known non-main history remains blocked, and catalog bodies are classified without disclosure',async()=>{
  const source=fs.readFileSync(new URL('../apps/api/prisma/migrations/20260715013100_auction_atomic_execution/migration.sql',import.meta.url),'utf8');
  const canonicalBody=name=>source.match(new RegExp('CREATE OR REPLACE FUNCTION '+name.replace('.','\\.')+'\\s*\\([\\s\\S]*?\\bAS\\s+(\\$[^$]*\\$)([\\s\\S]*?)\\1','i'))[2];
  const functions=[{name:'auction.record_admission',body:canonicalBody('auction.record_admission'),owner:'private-owner'},
    {name:'auction.place_bid',body:canonicalBody('auction.place_bid'),grants:'private-grants'},
    {name:'dealx.participant_tenant',body:'private-function-body'}];
  let calls=0;
  const tx={$queryRawUnsafe:async sql=>{
    assert.match(sql,/^SELECT /);assert.doesNotMatch(sql,/\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|set_config)\b/i);
    return calls++===0?functions:[{policyname:'auction_lots_market_showcase_select',qual:'private-policy-expression'}];
  }};
  const ledger=historicalLedger(),error=unknownError(ledger);
  await attachHistoricalDiagnostics(tx,error,ledger);
  assert.equal(calls,2);assert.equal(error.message,'UNRECOGNIZED_APPLIED_MIGRATION');
  rejects(()=>classifyLedger(manifest,ledger),'UNRECOGNIZED_APPLIED_MIGRATION');
  const payload=probeErrorPayload(error),output=probeDiagnostics(payload),evidence=parseEvidence(output+historicalTerminal);
  assert.equal(evidence.PC_W1_HISTORY_LEDGER,'EXACT_FOUR_SOURCE_CHECKSUMS');
  assert.equal(evidence.PC_W1_HISTORY_CATALOG,'OBSERVED');assert.equal(evidence.PC_W1_HISTORY_POLICIES,'1');
  assert.equal(evidence.PC_W1_HISTORY_FUNCTION_00,'ABSENT');assert.equal(evidence.PC_W1_HISTORY_FUNCTION_01,'CANONICAL_BODY');
  assert.equal(evidence.PC_W1_HISTORY_FUNCTION_02,'CANONICAL_BODY');assert.equal(evidence.PC_W1_HISTORY_FUNCTION_03,'OTHER_BODY');
  for(let index=0;index<4;index++) {
    const key=`PC_W1_HISTORY_FUNCTION_0${index}_SHA256`;
    const wrong=index===3?HISTORICAL_FUNCTIONS[3][1]:'0'.repeat(64);
    rejects(()=>parseEvidence(output.replace(`${key}=${evidence[key]}`,`${key}=${wrong}`)+historicalTerminal),'CONTRADICTORY_HISTORY_DIAGNOSTICS');
  }
  rejects(()=>parseEvidence(output.replace('HISTORY_FUNCTION_01=CANONICAL_BODY','HISTORY_FUNCTION_01=HISTORICAL_BODY')+historicalTerminal),'CONTRADICTORY_HISTORY_DIAGNOSTICS');
  for(let index=0;index<4;index++) for(const field of ['NAME','CHECKSUM','VALUE']) {
    const key=`PC_W1_UNKNOWN_0${index}_${field}_SHA256`;
    rejects(()=>parseEvidence(output.replace(`${key}=${evidence[key]}`,`${key}=${'0'.repeat(64)}`)+historicalTerminal),'CONTRADICTORY_HISTORY_DIAGNOSTICS');
  }
  let duplicate=output,permuted=output;
  for(const field of ['NAME','CHECKSUM','VALUE']) {
    const first=`PC_W1_UNKNOWN_00_${field}_SHA256`,second=`PC_W1_UNKNOWN_01_${field}_SHA256`;
    duplicate=duplicate.replace(`${second}=${evidence[second]}`,`${second}=${evidence[first]}`);
    permuted=permuted.replace(`${first}=${evidence[first]}`,`${first}=${evidence[second]}`)
      .replace(`${second}=${evidence[second]}`,`${second}=${evidence[first]}`);
  }
  rejects(()=>parseEvidence(duplicate+historicalTerminal),'CONTRADICTORY_HISTORY_DIAGNOSTICS');
  assert.equal(parseEvidence(permuted+historicalTerminal).PC_W1_HISTORY_LEDGER,'EXACT_FOUR_SOURCE_CHECKSUMS');
  assert.doesNotMatch(JSON.stringify(payload),/private-|participant_tenant|record_admission|policyname|qual/);
  for(const [key,value] of Object.entries(payload.historicalDiagnostics)) {
    rejects(()=>parseEvidence(output.replace(`${key}=${value}\n`,'')+historicalTerminal),'CONTRADICTORY_HISTORY_DIAGNOSTICS');
  }
  const withoutHistory=output.split('\n').filter(line=>!line.startsWith('PC_W1_HISTORY_')).join('\n');
  rejects(()=>parseEvidence(withoutHistory+historicalTerminal),'CONTRADICTORY_HISTORY_DIAGNOSTICS');
  const withoutObservation=probeErrorPayload(unknownError(ledger));
  assert.equal(withoutObservation.historicalDiagnostics.PC_W1_HISTORY_CATALOG,'NOT_OBSERVED');
  assert.equal(parseEvidence(probeDiagnostics(withoutObservation)+historicalTerminal).PC_W1_HISTORY_CATALOG,'NOT_OBSERVED');
  rejects(()=>parseEvidence(output+historicalTerminal.replace('MUTATION=NONE','MUTATION=BOUNDED_EIGHT_MIGRATIONS')),'CONTRADICTORY_LEDGER_DIAGNOSTICS');
  rejects(()=>parseEvidence(output.replace('HISTORY_CATALOG=OBSERVED','HISTORY_CATALOG=UNAVAILABLE')+historicalTerminal),'CONTRADICTORY_HISTORY_DIAGNOSTICS');
  const checker=fs.readFileSync(new URL('./check-production-pc-crop-w1-acceptance.mjs',import.meta.url),'utf8');
  const transport=spawnSync(process.execPath,['--input-type=module','-e',checker,'--','--runtime-tool','probe-diagnostics'],{input:JSON.stringify(payload),encoding:'utf8'});
  assert.equal(transport.status,0);assert.equal(transport.stdout,output);assert.equal(transport.stderr,'');
});
test('historical provenance rejects checksum changes, incomplete sets, duplicate rows and extra unknown rows',async()=>{
  const mismatch=historicalLedger();mismatch[0].checksum='0'.repeat(64);
  const duplicate=historicalLedger();duplicate.push({...duplicate[0]});
  const extra=[...historicalLedger(),{...finished(baseName),migration_name:'private-extra'}];
  for(const ledger of [mismatch,historicalLedger().slice(1),duplicate,extra]) {
    const error=unknownError(ledger);await attachHistoricalDiagnostics({$queryRawUnsafe:async()=>[]},error,ledger);
    assert.equal(error.historicalDiagnostics.PC_W1_HISTORY_LEDGER,'UNRECONCILED');
    assert.equal(error.message,'UNRECOGNIZED_APPLIED_MIGRATION');
  }
  const error=new Error('UNFINISHED_MIGRATION');
  await attachHistoricalDiagnostics({$queryRawUnsafe:()=>assert.fail('Unrelated blocker queried catalog')},error,historicalLedger());
  assert.equal(error.historicalDiagnostics,undefined);
});
test('catalog failures, overloads and ambiguous functions preserve the original blocked result',async()=>{
  for(const query of [async()=>{throw new Error('private-database-url');},async()=>Array.from({length:17},()=>({body:'secret'}))]) {
    const ledger=historicalLedger(),error=unknownError(ledger);
    await attachHistoricalDiagnostics({$queryRawUnsafe:query},error,ledger);
    const payload=probeErrorPayload(error),output=probeDiagnostics(payload);
    assert.doesNotMatch(output,/private-|secret/);
    assert.equal(parseEvidence(output+historicalTerminal).PC_W1_HISTORY_CATALOG,'UNAVAILABLE');
    assert.equal(error.message,'UNRECOGNIZED_APPLIED_MIGRATION');
  }
  let calls=0;const ledger=historicalLedger(),error=unknownError(ledger);
  await attachHistoricalDiagnostics({$queryRawUnsafe:async()=>calls++===0?
    [{name:HISTORICAL_FUNCTIONS[0][0],body:'one'},{name:HISTORICAL_FUNCTIONS[0][0],body:'two'}]:[]},error,ledger);
  assert.equal(error.historicalDiagnostics.PC_W1_HISTORY_FUNCTION_00,'AMBIGUOUS');
  const tampered=probeErrorPayload(error);tampered.historicalDiagnostics.PC_W1_HISTORY_CATALOG_SHA256='private-value';
  assert.doesNotMatch(probeDiagnostics(tampered),/private-value/);
});
test('invalid ledger checksum and untrusted error properties cannot leak raw text',()=>{
  let failure;
  try {classifyLedger(manifest,[{...finished(baseName),checksum:'secret=/private/config'}]);}catch(error){failure=error;}
  assert.equal(probeErrorPayload(failure).checksumDrift.appliedSha256,'INVALID');
  assert.doesNotMatch(probeDiagnostics(probeErrorPayload(failure)),/secret|private/);
  for(const key of ['migrationSha256','expectedSha256','appliedSha256']){
    const altered=probeErrorPayload(failure);altered.checksumDrift[key]='secret=/private/config';
    assert.equal(probeDiagnostics(altered),'');
  }
  assert.deepEqual(probeErrorPayload(new Error('secret=/private/config')),{error:'UNCLASSIFIED_PROBE_FAILURE'});
  assert.equal(probeDiagnostics({error:'OTHER_FAILURE',checksumDrift:probeErrorPayload(failure).checksumDrift}),'');
});
test('rolled-back records are not counted as successful applications',()=>{
  assert.equal(classifyLedger(manifest,[finished(baseName),{...finished(Object.keys(TARGET_MIGRATIONS)[0]),rolled_back_at:'2026-09-08'}]).pendingCount,8);
});
test('accepted SQL cannot be substituted by target manifest or image',()=>{
  const changed={...manifest,[Object.keys(TARGET_MIGRATIONS)[0]]:'0'.repeat(64)};
  rejects(()=>validateManifest(changed),'ACCEPTED_MIGRATION_CHECKSUM_MISMATCH');
  rejects(()=>validateImageManifest(manifest,changed),'ACCEPTED_MIGRATION_CHECKSUM_MISMATCH');
});
test('image SQL set must exactly equal entire repository, regardless of key ordering',()=>{
  validateImageManifest(manifest,Object.fromEntries(Object.entries(manifest).reverse()));
  rejects(()=>validateImageManifest(manifest,TARGET_MIGRATIONS),'IMAGE_MIGRATION_SET_MISMATCH');
  rejects(()=>validateImageManifest(manifest,{...manifest,'20260909000000_added_in_image':'0'.repeat(64)}),'IMAGE_MIGRATION_SET_MISMATCH');
});
test('actual repository history including the legacy initial migration admits only the exact eight pending',()=>{
  const root=fileURLToPath(new URL('../apps/api/prisma/migrations/',import.meta.url));
  const actual=readMigrationManifest(root);
  assert.ok(Object.keys(actual).length>Object.keys(TARGET_MIGRATIONS).length);
  assert.equal(actual['0001_postgresql_initial'],crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'0001_postgresql_initial/migration.sql'))).digest('hex'));
  validateImageManifest(actual,decodeManifest(Buffer.from(JSON.stringify(actual)).toString('base64')));
  const ledger=Object.entries(actual).filter(([name])=>!Object.hasOwn(TARGET_MIGRATIONS,name)).map(([migration_name,checksum])=>({migration_name,checksum,finished_at:'2026-09-08',rolled_back_at:null}));
  assert.deepEqual(classifyLedger(actual,ledger),{decision:'READY_EXACT_EIGHT',pendingCount:8,legacyInitialMarker:'ABSENT'});
  const changed={...actual,'0001_postgresql_initial':'0'.repeat(64)};
  rejects(()=>validateImageManifest(actual,changed),'IMAGE_MIGRATION_SET_MISMATCH');
  rejects(()=>classifyLedger(actual,ledger.map(row=>row.migration_name==='0001_postgresql_initial'?{...row,checksum:'0'.repeat(64)}:row)),'APPLIED_MIGRATION_CHECKSUM_DRIFT');
  const missing={...actual}; delete missing['0001_postgresql_initial'];
  rejects(()=>validateImageManifest(actual,missing),'IMAGE_MIGRATION_SET_MISMATCH');
});
for(const name of ['0002_unaccepted','0001_postgresql_initial_copy','0001_postgresql_initial/child','20260905040000_inventory-reservation']) test(`legacy initial exception does not admit other migration names: ${name}`,()=>{
  rejects(()=>validateManifest({...manifest,[name]:'0'.repeat(64)}),'REPOSITORY_MANIFEST_INVALID');
});
for(const kind of ['directory-symlink','sql-symlink','lock-symlink','unexpected-file']) test(`repository and image scanner rejects ${kind}`,()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'pc-w1-manifest-'));
  try {
    const root=path.join(temporary,'migrations');fs.mkdirSync(root);
    const external=path.join(temporary,'external');fs.mkdirSync(external);fs.writeFileSync(path.join(external,'migration.sql'),'SELECT 1;');
    if(kind==='directory-symlink')fs.symlinkSync(external,path.join(root,'0001_postgresql_initial'));
    if(kind==='sql-symlink') {fs.mkdirSync(path.join(root,'0001_postgresql_initial'));fs.symlinkSync(path.join(external,'migration.sql'),path.join(root,'0001_postgresql_initial/migration.sql'));}
    if(kind==='lock-symlink')fs.symlinkSync(path.join(external,'migration.sql'),path.join(root,'migration_lock.toml'));
    if(kind==='unexpected-file')fs.writeFileSync(path.join(root,'unaccepted'),'SELECT 1;');
    rejects(()=>readMigrationManifest(root),kind==='sql-symlink'?'MIGRATION_SQL_FILE_INVALID':kind==='lock-symlink'?'MIGRATION_LOCK_FILE_INVALID':'MIGRATION_DIRECTORY_INVALID');
  } finally {fs.rmSync(temporary,{recursive:true,force:true});}
});
for(const malformed of [null,[],{},'text',{'../../private':'0'.repeat(64)},{[baseName]:'not-a-checksum'}]) test(`malformed manifest rejected ${JSON.stringify(malformed)}`,()=>{
  rejects(()=>validateManifest(malformed),'REPOSITORY_MANIFEST_INVALID');
});
test('base64 transport must decode to validated manifest',()=>{
  assert.deepEqual(decodeManifest(Buffer.from(JSON.stringify(manifest)).toString('base64')),validateManifest(manifest));
  rejects(()=>decodeManifest('credential=/protected/path'),'REPOSITORY_MANIFEST_INVALID');
});

test('PostgreSQL production profile allows disabled real integrations and effective shadow defaults',()=>{
  validateApiEnvironment({...environment(),FGIS_MODE:'disabled'});
  validateApiEnvironment({...environment(),ROLE_ELIGIBILITY_SHADOW_MODE:'true',ROLE_ELIGIBILITY_ENFORCEMENT:'false'});
});
for(const mode of ['stub','MOCK',' fake ','demo','sandbox','test']) test(`explicit production non-live mode blocks: ${mode}`,()=>{
  rejects(()=>validateApiEnvironment({...environment(),FGIS_GRAIN_MODE:mode}),'NON_LIVE_INTEGRATION_MODE_ENABLED');
});
for(const repo of ['DEAL','DOCUMENT','SHIPMENT','LAB','PAYMENT']) test(`PostgreSQL authority required for ${repo}`,()=>{
  rejects(()=>validateApiEnvironment({...environment(),[`PLATFORM_V7_${repo}_REPOSITORY`]:'memory'}),'NON_POSTGRESQL_RUNTIME_AUTHORITY');
});
test('runtime test accounts, public mutation, shadow changes and enforcement block',()=>{
  for(const flag of ['AUTH_TEST_ACCOUNTS_ENABLED','ALLOW_RUNTIME_MUTATION']) rejects(()=>validateApiEnvironment({...environment(),[flag]:'true'}),'TEST_RUNTIME_ENABLED');
  rejects(()=>validateApiEnvironment({...environment(),ROLE_ELIGIBILITY_ENFORCEMENT:'true'}),'ELIGIBILITY_ENFORCEMENT_ENABLED');
  rejects(()=>validateApiEnvironment({...environment(),ROLE_ELIGIBILITY_SHADOW_MODE:'false'}),'ELIGIBILITY_SHADOW_NOT_CONFIRMED');
  rejects(()=>validateApiEnvironment({...environment(),NODE_ENV:'test'}),'API_NOT_PRODUCTION');
});

test('identity SQL imports a live read-only snapshot and checks actual principal/session/database',()=>{
  const sql=snapshotSql(pre());
  assert.match(sql,/BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY/);
  assert.match(sql,/SET TRANSACTION SNAPSHOT '00000003-000001AB-1'/);
  assert.match(sql,/datid=42/); assert.match(sql,/usesysid=16384/); assert.match(sql,/pid=12/);
  assert.match(sql,/application_name='pc_w1_c{32}'/);
  assert.match(sql,/API_MIGRATION_DATABASE_MISMATCH/);
  assert.doesNotMatch(sql,/DATABASE_URL|INSERT|UPDATE|DELETE|CREATE ROLE/);
});
for(const [field,value,code] of [
  ['snapshot',"x';COMMIT;--",'SNAPSHOT_TOKEN_INVALID'],['nonce',"x' OR true--",'SNAPSHOT_NONCE_INVALID'],
  ['pid','12;COMMIT','SNAPSHOT_IDENTITY_INVALID'],['databaseOid',-1,'SNAPSHOT_IDENTITY_INVALID'],
  ['roleOid',Number.MAX_SAFE_INTEGER+1,'SNAPSHOT_IDENTITY_INVALID'],['decision','PASS','SNAPSHOT_DECISION_INVALID'],
  ['pendingCount',0,'SNAPSHOT_PENDING_COUNT_INVALID'],['tables',24,'SNAPSHOT_SCHEMA_INVALID'],
  ['environmentHash','private value','API_ENVIRONMENT_HASH_INVALID'],
]) test(`snapshot field cannot inject or contradict evidence: ${field}`,()=>rejects(()=>snapshotSql({...pre(),[field]:value}),code));
test('post snapshot must evidence catalog hash and all tables',()=>{
  const value={...pre(),decision:'VERIFIED_ALREADY_APPLIED',pendingCount:0,tables:24,structuralChecks:'PASS'};
  rejects(()=>validateSnapshot(value),'SNAPSHOT_CATALOG_HASH_INVALID');
  validateSnapshot({...value,catalogHash:'f'.repeat(64)});
});

test('image metadata requires exact digest, target, nonroot and canonical CLI',()=>validateMigrationImage(image(),target,digest));
for(const [property,value,code] of [
  ['RepoDigests',[], 'MIGRATION_IMAGE_DIGEST_MISMATCH'],
  ['Config.User','root','MIGRATION_IMAGE_USER_INVALID'],
  ['Config.WorkingDir','/other','MIGRATION_IMAGE_COMMAND_INVALID'],
  ['Config.Cmd',['node_modules/prisma/build/index.js','db','push'],'MIGRATION_IMAGE_COMMAND_INVALID'],
  ['Config.Entrypoint',['/bin/sh'],'MIGRATION_IMAGE_COMMAND_INVALID'],
  ['Config.Labels',{'org.opencontainers.image.revision':'0'.repeat(40)},'MIGRATION_IMAGE_REVISION_MISMATCH'],
]) test(`altered image rejected: ${property}`,()=>{
  const valueImage=image(),parts=property.split('.');
  parts.reduce((parent,key,index)=>index===parts.length-1?(parent[key]=value):parent[key],valueImage);
  rejects(()=>validateMigrationImage(valueImage,target,digest),code);
});
test('mutable migration tags cannot be execution authority',()=>rejects(()=>validateMigrationImage(image(),target,'ghcr.io/pachaninm-lab/grainflow-migration:latest'),'MIGRATION_IMAGE_REFERENCE_INVALID'));
test('Compose requires one canonical migration service',()=>{
  assert.equal(validateCompose(compose()),'migration');
  const value=compose(); value.services.second=clone(value.services.migration);
  rejects(()=>validateCompose(value),'MIGRATION_SERVICE_AMBIGUOUS');
});
for(const [property,value] of [['volumes',[{source:'/protected',target:'/app'}]],['command',['arbitrary']],['entrypoint',['sh']],['user','root'],['working_dir','/other'],['privileged',true],['network_mode','host']]) test(`Compose cannot replace verified migration code: ${property}`,()=>{
  const valueCompose=compose(); valueCompose.services.migration[property]=value;
  rejects(()=>validateCompose(valueCompose),'MIGRATION_SERVICE_RUNTIME_OVERRIDE');
});

test('non-API fingerprint is stable to container enumeration ordering',()=>{
  assert.equal(runtimeFingerprint([container('e'),container('f')]),runtimeFingerprint([container('f'),container('e')]));
});
for(const modify of [value=>value.State.StartedAt='2026-09-08T00:00:01Z',value=>value.Id='1'.repeat(64),value=>value.Config.Env.push('FGIS_MODE=mock'),value=>value.Image=`sha256:${'0'.repeat(64)}`,value=>value.Mounts.push({Source:'/private',Destination:'/etc/config'}),value=>value.NetworkSettings.Networks.isolated.EndpointID='new']) test(`runtime fingerprint detects mutation ${modify}`,()=>{
  const before=container(),after=clone(before); modify(after);
  assert.notEqual(runtimeFingerprint([before]),runtimeFingerprint([after]));
});
test('runtime fingerprint treats Docker inspect mounts as an unordered inventory without dropping entries',()=>{
  const before=container();
  before.Mounts=[{Type:'bind',Source:'/fixture/a',Destination:'/a',RW:false},
    {Type:'volume',Name:'fixture-volume',Source:'/fixture/b',Destination:'/b',Driver:'local',Mode:'rw',RW:true,Propagation:'rprivate'}];
  const after=structuredClone(before); after.Mounts.reverse();
  assert.equal(runtimeFingerprint([before]),runtimeFingerprint([after]));
  assert.equal(runtimeDiff([before],[after]).count,0);
  assert.deepEqual(before.Mounts.map(m=>m.Destination),['/a','/b']);
  for(const mutate of [m=>m.Type='tmpfs',m=>m.Name='other',m=>m.Source='/fixture/other',m=>m.Destination='/other',
    m=>m.Driver='other',m=>m.Mode='ro',m=>m.RW=false,m=>m.Propagation='shared',m=>m.FutureOption={enabled:true}]) {
    const changed=structuredClone(after); mutate(changed.Mounts[0]);
    assert.notEqual(runtimeFingerprint([before]),runtimeFingerprint([changed]));
    assert.deepEqual(runtimeDiff([before],[changed]).fields,['MOUNTS_CHANGED']);
  }
  for(const mounts of [[before.Mounts[0]],[...before.Mounts,before.Mounts[0]],[]]) {
    const changed=structuredClone(before); changed.Mounts=mounts;
    assert.notEqual(runtimeFingerprint([before]),runtimeFingerprint([changed]));
  }
});

test('outer workflow sibling guard preserves mount identity while ignoring enumeration order',()=>{
  const workflow=fs.readFileSync(new URL('../.github/workflows/pc-crop-w1-production-acceptance.yml',import.meta.url),'utf8');
  const source=workflow.match(/API_EXCLUDED="\$api" python3 -c '([^']+)'/);
  assert.ok(source,'execute the actual outer sibling guard');
  const hash=value=>{
    const result=spawnSync('python3',['-c','import sys, textwrap; exec(compile(textwrap.dedent(sys.argv[1]), "<sibling_hash>", "exec"))',source[1]],{input:JSON.stringify(value),encoding:'utf8',env:{...process.env,API_EXCLUDED:'a'.repeat(64)}});
    assert.equal(result.status,0,result.stderr);
    assert.equal(result.stderr,''); assert.match(result.stdout,/^[0-9a-f]{64}\n$/);
    return result.stdout.trim();
  };
  const before=container(); before.Mounts=[{Source:'/fixture/a',Destination:'/a',RW:false},{Source:'/fixture/b',Destination:'/b',RW:true}];
  const permuted=clone(before); permuted.Mounts.reverse();
  assert.equal(hash([before]),hash([permuted]));
  const privateFixture=clone(before);
  privateFixture.Config.Env.push('PRIVATE_FIXTURE=must-remain-inside-hash');
  privateFixture.Mounts[0].Source='/private-fixture/must-remain-inside-hash';
  assert.notEqual(hash([before]),hash([privateFixture]));
  for(const mutate of [x=>x.Mounts[0].Source='/fixture/changed',x=>x.Mounts[0].RW=false,
    x=>x.Mounts[0].FutureOption='changed',x=>x.Mounts.push(clone(x.Mounts[0])),x=>x.Mounts.pop(),
    x=>x.Config.Env.push('CHANGED=true'),x=>x.State.StartedAt='2026-09-09T00:00:01Z']) {
    const changed=clone(permuted); mutate(changed); assert.notEqual(hash([before]),hash([changed]));
  }
});

test('mount inventory canonicalizes object fields but preserves nested array order',()=>{
  const before=container();
  before.Mounts=[{Source:'/z',Destination:'/a',Options:{second:2,first:1},Sequence:['ro','bind']},
    {Source:'/a',Destination:'/z',RW:true}];
  const after=clone(before);
  after.Mounts=after.Mounts.reverse().map(m=>Object.fromEntries(Object.entries(m).reverse()));
  after.Mounts[1].Options={first:1,second:2};
  assert.equal(runtimeFingerprint([before]),runtimeFingerprint([after]));
  assert.equal(runtimeDiff([before],[after]).count,0);
  after.Mounts[1].Sequence.reverse();
  assert.notEqual(runtimeFingerprint([before]),runtimeFingerprint([after]));
  assert.deepEqual(runtimeDiff([before],[after]).fields,['MOUNTS_CHANGED']);
});

test('runtime diff classifies a Compose one-off addition without exposing identity',()=>{
  const before=[container('e')], after=[...before,clone(container('1'))];
  after[1].Config.Labels['com.docker.compose.oneoff']='True';
  const diff=runtimeDiff(before,after);
  assert.deepEqual(diff.fields,['ADDED_ONEOFF_CONTAINER']);
  assert.equal(diff.count,1);
  assert.equal(diff.oneoffAdded,1);
  assert.equal(diff.oneoffRemoved,0);
});
test('runtime diff records bounded state and network changes',()=>{
  const before=[container()], after=clone(before);
  after[0].State.StartedAt='2026-09-09T00:00:01Z';
  after[0].NetworkSettings.Networks.isolated.EndpointID='changed';
  const diff=runtimeDiff(before,after);
  assert.deepEqual(diff.fields,['NETWORK_CHANGED','STATE_CHANGED']);
  assert.equal(diff.count,1);
});

function transportedRuntimeEvidence(before,after) {
  const workflow=fs.readFileSync(new URL('../.github/workflows/pc-crop-w1-production-acceptance.yml',import.meta.url),'utf8');
  const transport=workflow.match(/RAW_FILE="\$raw" node - <<'NODE'[^\n]*\n([\s\S]*?)\n\s*NODE\n/);
  assert.ok(transport,'accepted workflow output sanitizer must be exercised');
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'w1-runtime-evidence-'));
  try {
    const raw=path.join(temporary,'raw');
    const evidence=runtimeDiffEvidence(before,after)+'\nPC_W1_ERROR=API_OR_NON_API_RUNTIME_CHANGED\nPC_W1_DATABASE_MUTATION=NONE\nPC_W1_RESULT=BLOCKED\n';
    fs.writeFileSync(raw,evidence+'private-path=/not-for-publication\n');
    const result=spawnSync(process.execPath,['-e',transport[1]],{encoding:'utf8',env:{...process.env,RAW_FILE:raw}});
    assert.equal(result.status,0,result.stderr);
    assert.equal(result.stdout,evidence,'all typed diagnostic lines must survive the real workflow sanitizer');
    return parseEvidence(result.stdout);
  } finally {fs.rmSync(temporary,{recursive:true,force:true});}
}
test('multi-field runtime diagnostics survive the accepted workflow transport',()=>{
  const before=[container()],after=clone(before);
  after[0].State.StartedAt='2026-09-09T00:00:01Z';
  after[0].NetworkSettings.Networks.isolated.EndpointID='changed';
  const evidence=transportedRuntimeEvidence(before,after);
  assert.equal(evidence.PC_W1_RUNTIME_DIFF_FIELDS,'NETWORK_CHANGED__STATE_CHANGED');
  assert.equal(evidence.PC_W1_RUNTIME_DIFF_COUNT,'1');
});
test('serialization order remains a blocker and is explicitly diagnosed',()=>{
  const before=[container()],after=clone(before);
  after[0].Config=Object.fromEntries(Object.entries(after[0].Config).reverse());
  assert.notEqual(runtimeFingerprint(before),runtimeFingerprint(after));
  const evidence=transportedRuntimeEvidence(before,after);
  assert.equal(evidence.PC_W1_RUNTIME_DIFF_FIELDS,'SERIALIZATION_ORDER_CHANGED');
  assert.equal(evidence.PC_W1_RUNTIME_DIFF_COUNT,'1');
});
test('runtime diagnostic overflow stays transport-safe and explicitly marked',()=>{
  const before=[container('1'),container('2'),container('3')],after=[clone(before[0]),container('4'),container('5')];
  before[2].Config.Labels['com.docker.compose.oneoff']='True';
  after[2].Config.Labels['com.docker.compose.oneoff']='True';
  Object.assign(after[0],{Image:`sha256:${'b'.repeat(64)}`,State:{Running:false,StartedAt:'changed'},
    HostConfig:{ReadonlyRootfs:true},Mounts:[{Source:'/private',Destination:'/other'}]});
  after[0].Config.Env.push('PRIVATE_VALUE=not-for-publication');
  after[0].NetworkSettings.Networks.isolated.EndpointID='changed';
  const evidence=transportedRuntimeEvidence(before,after);
  assert.ok(evidence.PC_W1_RUNTIME_DIFF_FIELDS.length<=100);
  assert.match(evidence.PC_W1_RUNTIME_DIFF_FIELDS,/__MULTIPLE$/);
  assert.equal(evidence.PC_W1_RUNTIME_DIFF_COUNT,'5');
  assert.equal(evidence.PC_W1_RUNTIME_DIFF_ONEOFF_ADDED,'1');
  assert.equal(evidence.PC_W1_RUNTIME_DIFF_ONEOFF_REMOVED,'1');
  rejects(()=>parseEvidence(`PC_W1_RUNTIME_DIFF_FIELDS=SECRET_VALUE\n`,{requireTerminal:false}),'UNSAFE_REMOTE_OUTPUT');
});

test('worker shadow contract cannot be silently disabled',()=>{
  const value=container();value.Config.Labels['com.docker.compose.service']='role-eligibility-worker';
  rejects(()=>runtimeFingerprint([value]),'ELIGIBILITY_WORKER_NOT_SHADOW');
  value.Config.Env.push('ROLE_ELIGIBILITY_SHADOW_MODE=true'); runtimeFingerprint([value]);
  value.Config.Env.push('ROLE_ELIGIBILITY_ENFORCEMENT=true'); rejects(()=>runtimeFingerprint([value]),'ELIGIBILITY_WORKER_NOT_SHADOW');
});

test('strict evidence accepts only bounded ready or verification claims',()=>{
  parseEvidence(lines(readyEvidence()));
  parseEvidence(lines({...readyEvidence(),PC_W1_PENDING_MIGRATIONS:'0',PC_W1_SCHEMA_TABLES:'24',PC_W1_SCHEMA_STRUCTURAL_CHECKS:'PASS',
    PC_W1_SCHEMA_CATALOG_SHA256:'f'.repeat(64),PC_W1_RESULT:'VERIFIED_ALREADY_APPLIED'}));
});
test('completed migrations require nonempty readable-archive evidence and remain functionally unaccepted',()=>{
  const value={...readyEvidence(),PC_W1_PENDING_MIGRATIONS:'0',PC_W1_SCHEMA_TABLES:'24',PC_W1_SCHEMA_STRUCTURAL_CHECKS:'PASS',
    PC_W1_SCHEMA_CATALOG_SHA256:'f'.repeat(64),PC_W1_RESULT:'MIGRATIONS_APPLIED_PENDING_API_ACCEPTANCE',PC_W1_DATABASE_MUTATION:'BOUNDED_EIGHT_MIGRATIONS'};
  rejects(()=>parseEvidence(lines(value)),'MISSING_MUTATION_BACKUP_EVIDENCE');
  parseEvidence(lines({...value,PC_W1_BACKUP_SHA256:'a'.repeat(64),PC_W1_BACKUP_BYTES:'1024',PC_W1_BACKUP_VERIFICATION:'ARCHIVE_LIST_ONLY'}));
});
for(const suffix of ['\n/protected/server/path','\nDATABASE_URL=postgresql://private','\nPC_W1_FULL_ACCEPTANCE=PASS','\nPC_W1_UNKNOWN=PASS','\nPC_W1_RESULT=READY_EXACT_EIGHT']) test(`unsafe or duplicate remote output rejected ${suffix}`,()=>{
  assert.throws(()=>parseEvidence(lines(readyEvidence())+suffix));
});
test('contradictory ready, mutation and error claims cannot pass',()=>{
  rejects(()=>parseEvidence(lines({...readyEvidence(),PC_W1_ERROR:'SOME_FAILURE'})),'CONTRADICTORY_REMOTE_EVIDENCE');
  rejects(()=>parseEvidence(lines({...readyEvidence(),PC_W1_PENDING_MIGRATIONS:'0'})),'PRE_MIGRATION_EVIDENCE_INVALID');
  rejects(()=>parseEvidence(lines({...readyEvidence(),PC_W1_DATABASE_MUTATION:'MAY_HAVE_PARTIALLY_APPLIED'})),'UNEXPECTED_MUTATION_EVIDENCE');
  const value=readyEvidence();delete value.PC_W1_NON_API_RUNTIME_SHA256;
  rejects(()=>parseEvidence(lines(value)),'INCOMPLETE_REMOTE_EVIDENCE');
});
test('failure after migration begins cannot be confused with zero mutation',()=>{
  const value=parseEvidence('PC_W1_ERROR=BOUNDED_MIGRATION_FAILED\nPC_W1_DATABASE_MUTATION=MAY_HAVE_PARTIALLY_APPLIED\nPC_W1_RESULT=BLOCKED');
  assert.equal(value.PC_W1_DATABASE_MUTATION,'MAY_HAVE_PARTIALLY_APPLIED');
  rejects(()=>parseEvidence('PC_W1_RESULT=BLOCKED'),'MISSING_BLOCKER_CODE');
});
test('observed source revisions survive a blocked probe without implying acceptance',()=>{
  const raw=lines({PC_W1_TARGET_SHA:target,PC_W1_BASELINE_API_SHA:'b'.repeat(40),
    PC_W1_ERROR:'API_DATABASE_PRINCIPAL_NOT_CONFINED',PC_W1_DATABASE_MUTATION:'NONE',PC_W1_RESULT:'BLOCKED'});
  const evidence=parseEvidence(raw);
  assert.equal(evidence.PC_W1_BASELINE_API_SHA,'b'.repeat(40));
  assert.equal(evidence.PC_W1_RESULT,'BLOCKED');
  assert.equal(evidence.PC_W1_RUNTIME_UNCHANGED,undefined);
  assert.equal(evidence.PC_W1_FULL_ACCEPTANCE,undefined);
  rejects(()=>parseEvidence(raw.replace('b'.repeat(40),'/private/source')),'UNSAFE_REMOTE_OUTPUT');
  rejects(()=>parseEvidence(raw+'\nPC_W1_BASELINE_API_SHA='+target),'DUPLICATE_REMOTE_EVIDENCE');
});
test('untrusted error text is redacted to a bounded code',()=>{
  assert.equal(errorCode(new Error('SQL failed at /private/config with secret=value')),'UNCLASSIFIED_PROBE_FAILURE');
  assert.equal(errorCode(new Error('API_DATABASE_PRINCIPAL_NOT_CONFINED')),'API_DATABASE_PRINCIPAL_NOT_CONFINED');
});
test('shell invalid invocation fails before Docker and leaks no caller text',()=>{
  const script=fileURLToPath(new URL('./production-pc-crop-w1-migrations.sh',import.meta.url));
  const value=spawnSync('bash',[script,'/private/path?secret=value','bad','1'],{encoding:'utf8',env:{PATH:process.env.PATH}});
  assert.equal(value.status,1);assert.equal(value.stderr,'');
  assert.deepEqual({...parseEvidence(value.stdout)},{PC_W1_ERROR:'INVALID_ARGUMENTS',PC_W1_DATABASE_MUTATION:'NONE',PC_W1_RESULT:'BLOCKED'});
});
test('cleanup preserves the original error when a rejected probe has closed its pipe',()=>{
  const source=fs.readFileSync(new URL('./production-pc-crop-w1-migrations.sh',import.meta.url),'utf8');
  const cleanup=source.slice(source.indexOf('cleanup(){'),source.indexOf('\ntrap cleanup EXIT'));
  const script=`set -Eeuo pipefail\nprobe_pid=''; probe_read=''; temporary=''; failure_emitted=1; mutation=NONE\n${cleanup}\nexec {probe_write}> >(exit 0)\nchild=$!\nwait "$child"\ntrap cleanup EXIT\nexit 1\n`;
  const result=spawnSync('bash',[],{input:script,encoding:'utf8'});
  assert.equal(result.signal,null);assert.equal(result.status,1);assert.equal(result.stdout,'');
});
test('checker works as Docker eval helper without host Node or local paths',()=>{
  const source=fs.readFileSync(new URL('./check-production-pc-crop-w1-acceptance.mjs',import.meta.url),'utf8');
  const value=spawnSync(process.execPath,['--input-type=module','-e',source,'--','--runtime-tool','snapshot-sql'],{input:JSON.stringify(pre()),encoding:'utf8'});
  assert.equal(value.status,0,value.stderr); assert.equal(value.stdout,snapshotSql(pre()));
});
test('shell transport remains bounded and has valid Bash syntax',()=>{
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  checkSources(root);
  assert.equal(spawnSync('bash',['-n',path.join(root,'scripts/production-pc-crop-w1-migrations.sh')]).status,0);
});

// This rehearsal executes the real script and real Prisma images on a fresh
// GitHub-hosted Docker/PG16 contour. No production URLs, sessions or business
// records are accepted. Unit tests never stand in for this opt-in gate.
test('exact-image PostgreSQL transport, migration, restore and rejection rehearsal', {
  skip:process.env.PC_W1_REHEARSAL !== '1',timeout:1_500_000,
},()=>{
  assert.equal(process.env.GITHUB_ACTIONS,'true','REHEARSAL_REQUIRES_GITHUB_ACTIONS');
  assert.equal(process.env.RUNNER_ENVIRONMENT,'github-hosted','REHEARSAL_REQUIRES_DISPOSABLE_RUNNER');
  assert.equal(process.env.GITHUB_REPOSITORY,'pachaninm-lab/pachanin-demo','REHEARSAL_REPOSITORY_INVALID');
  assert.equal(process.getuid(),0,'REHEARSAL_REQUIRES_ROOT');
  const sha=process.env.PC_W1_TARGET_SHA,apiDigest=process.env.PC_W1_API_DIGEST,migrationDigest=process.env.PC_W1_MIGRATION_DIGEST;
  assert.match(sha??'',/^[0-9a-f]{40}$/);
  assert.match(apiDigest??'',/^ghcr\.io\/pachaninm-lab\/grainflow-api@sha256:[0-9a-f]{64}$/);
  assert.match(migrationDigest??'',/^ghcr\.io\/pachaninm-lab\/grainflow-migration@sha256:[0-9a-f]{64}$/);
  const root=process.env.PC_W1_REPOSITORY_ROOT || process.cwd();
  const report=process.env.PC_W1_REHEARSAL_REPORT;
  assert.ok(report && path.isAbsolute(report),'REHEARSAL_REPORT_REQUIRED');
  assert.ok(!fs.existsSync(report),'REHEARSAL_REPORT_MUST_BE_NEW');
  let sequence=0;
  const run=(command,args,{input,allowFailure=false,env=process.env,timeout=180_000,label=command}={})=>{
    const result=spawnSync(command,args,{input,encoding:'utf8',env,timeout,maxBuffer:32*1024*1024});
    if(!allowFailure) assert.equal(result.status,0,`REHEARSAL_${label.toUpperCase().replace(/[^A-Z0-9]/g,'_')}_FAILED`);
    return result;
  };
  assert.equal(run('git',['-C',root,'rev-parse','HEAD']).stdout.trim(),sha,'REHEARSAL_SOURCE_SHA_MISMATCH');
  assert.equal(run('docker',['ps','-q','--filter','label=com.docker.compose.service=api']).stdout.trim(),'','REHEARSAL_EXISTING_API_FORBIDDEN');
  const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'pc-w1-rehearsal-'));
  fs.chmodSync(fixture,0o755);
  const project=`pcw1rehearsal${crypto.randomBytes(6).toString('hex')}`;
  const password=crypto.randomBytes(20).toString('hex');
  const url=(database,role='postgres')=>`postgresql://${role}:${password}@postgres:5432/${database}?schema=public`;
  const composeFile=path.join(fixture,'compose.json');
  const bootstrap=path.join(fixture,'bootstrap');fs.mkdirSync(bootstrap,{mode:0o755});
  const migrationRoot=path.join(root,'apps/api/prisma/migrations');
  const repositoryManifest=readMigrationManifest(migrationRoot);
  fs.cpSync(path.join(root,'apps/api/prisma/schema.prisma'),path.join(bootstrap,'schema.prisma'));
  fs.mkdirSync(path.join(bootstrap,'migrations'),{mode:0o755});
  fs.copyFileSync(path.join(migrationRoot,'migration_lock.toml'),path.join(bootstrap,'migrations/migration_lock.toml'));
  for(const name of Object.keys(repositoryManifest)) if(!Object.hasOwn(TARGET_MIGRATIONS,name)) {
    fs.cpSync(path.join(migrationRoot,name),path.join(bootstrap,'migrations',name),{recursive:true});
  }
  const backupBefore=new Set(fs.readdirSync('/root').filter(name=>name.startsWith('pc-w1-backup.')));
  const createdBackups=[];
  let pgId,databaseImage,expectedHash,expectedBaselineHash,expectedHistoricalHash;
  const dc=(...args)=>run('docker',['compose','--project-directory',fixture,'--project-name',project,'-f',composeFile,...args],{label:'COMPOSE'});
  const sql=(statement,database='grainflow')=>run('docker',['exec','-i',pgId,'psql','-X','--set','ON_ERROR_STOP=1','-U','postgres','-d',database],{input:statement,label:'ISOLATED_SQL'});
  const configFor=(database='grainflow',migrationDatabase=database,mode='disabled')=>({
    services:{
      postgres:{image:databaseImage,environment:{POSTGRES_PASSWORD:password,POSTGRES_DB:'grainflow',POSTGRES_USER:'postgres'},
        healthcheck:{test:['CMD-SHELL','pg_isready -U postgres -d grainflow'],interval:'1s',timeout:'3s',retries:60}},
      api:{image:apiDigest,command:['-e','setInterval(()=>{},1000)'],environment:{...environment(),DATABASE_URL:url(database,'app_deal_api'),FGIS_GRAIN_MODE:mode}},
      migration:{image:migrationDigest,environment:{DATABASE_URL:url(migrationDatabase)}},
    },networks:{default:{internal:true}},
  });
  const writeConfig=(...args)=>fs.writeFileSync(composeFile,JSON.stringify(configFor(...args)),{mode:0o600});
  const moveApi=(...args)=>{writeConfig(...args);dc('up','-d','--no-deps','--force-recreate','--pull','never','api');};
  const imageDeploy=(database,schemaRoot)=>{
    const args=['run','--rm','--network',`${project}_default`,'-e',`DATABASE_URL=${url(database)}`];
    if(schemaRoot) args.push('--mount',`type=bind,src=${schemaRoot},dst=/bootstrap,readonly`);
    args.push(migrationDigest,'node_modules/prisma/build/index.js','migrate','deploy','--schema',schemaRoot?'/bootstrap/schema.prisma':'prisma/schema.prisma');
    run('docker',args,{timeout:300_000,label:'PRISMA_MIGRATE'});
  };
  const executor=(action='preflight',{expected=expectedHash,error}={})=>{
    const env={PATH:process.env.PATH,DOCKER_CONFIG:process.env.DOCKER_CONFIG,PC_W1_MIGRATION_DIGEST:migrationDigest,
      PC_W1_EXPECTED_MIGRATIONS_B64:Buffer.from(JSON.stringify(repositoryManifest)).toString('base64'),
      PC_W1_BASELINE_API_SHA:sha,PC_PROD_DIR_B64:Buffer.from(fixture).toString('base64'),
      PC_PROD_COMPOSE_B64:Buffer.from(composeFile).toString('base64'),PC_PROD_PROJECT_B64:Buffer.from(project).toString('base64')};
    if(expected) env.PC_W1_EXPECTED_CATALOG_SHA256=expected;
    if(expectedBaselineHash) env.PC_W1_EXPECTED_BASELINE_CATALOG_SHA256=expectedBaselineHash;
    if(expectedHistoricalHash) env.PC_W1_EXPECTED_HISTORICAL_CATALOG_SHA256=expectedHistoricalHash;
    const result=run('bash',[fileURLToPath(new URL('./production-pc-crop-w1-migrations.sh',import.meta.url)),action,sha,String(++sequence)],
      {env,allowFailure:true,timeout:300_000,label:'ACTUAL_EXECUTOR'});
    assert.equal(result.stderr,'','REHEARSAL_EXECUTOR_RAW_STDERR');
    const evidence=parseEvidence(result.stdout);
    if(error) {
      assert.equal(result.status,1,'REHEARSAL_EXPECTED_BLOCK');
      assert.equal(evidence.PC_W1_RESULT,'BLOCKED');assert.equal(evidence.PC_W1_ERROR,error);
      assert.equal(evidence.PC_W1_DATABASE_MUTATION,'NONE');
    } else {
      assert.equal(result.status,0,`REHEARSAL_EXECUTOR_BLOCKED_${evidence.PC_W1_ERROR ?? 'UNKNOWN'}`);
      assert.notEqual(evidence.PC_W1_RESULT,'BLOCKED');
    }
    return evidence;
  };
  try {
    const mirrorFile='.github/container-images/postgres-16.v1.json';
    const mirror=JSON.parse(fs.readFileSync(path.join(root,mirrorFile),'utf8'));
    assert.deepEqual(checkManifests([{file:mirrorFile,manifest:mirror}]),[],'REHEARSAL_POSTGRES_AUTHORITY_INVALID');
    databaseImage=`${mirror.mirrored_repository}@${mirror.mirrored_digest}`;
    run('docker',['pull',migrationDigest]);run('docker',['pull',apiDigest]);run('docker',['pull',databaseImage]);
    const metadata=JSON.parse(run('docker',['image','inspect',apiDigest]).stdout)[0];
    assert.equal(metadata.Config.Labels['org.opencontainers.image.revision'],sha);
    assert.ok(metadata.RepoDigests.includes(apiDigest));
    const pgMetadata=JSON.parse(run('docker',['image','inspect',databaseImage]).stdout)[0];
    assert.ok(pgMetadata.RepoDigests.includes(databaseImage),'REHEARSAL_POSTGRES_DIGEST_REQUIRED');
    writeConfig();dc('up','-d','--wait','--wait-timeout','90','postgres');
    pgId=dc('ps','-q','postgres').stdout.trim();assert.match(pgId,/^[0-9a-f]{64}$/);
    assert.match(sql('SHOW server_version;').stdout,/16\./);
    sql(`CREATE ROLE app_deal_api LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '${password}';`);
    imageDeploy('grainflow',bootstrap);
    sql('GRANT SELECT ON public._prisma_migrations TO app_deal_api;');
    sql("CREATE TABLE public.pc_w1_rehearsal_sentinel(id integer PRIMARY KEY,value text NOT NULL); INSERT INTO public.pc_w1_rehearsal_sentinel VALUES(1,'isolated-preservation-proof');");
    for(const database of ['reference','wrong','partial','historical','historical_partial']) sql(`CREATE DATABASE ${database} TEMPLATE grainflow;`);
    moveApi('grainflow');
    const baselineReference=executor();
    assert.equal(baselineReference.PC_W1_LINEAGE_PROFILE,'CANONICAL');
    expectedBaselineHash=baselineReference.PC_W1_LINEAGE_CATALOG_SHA256;
    const historyBootstrap=path.join(fixture,'historical-bootstrap');
    fs.cpSync(bootstrap,historyBootstrap,{recursive:true});
    for(const [index,[name,checksum]] of HISTORICAL_MIGRATIONS.entries()) {
      const bytes=fs.readFileSync(path.join(root,'scripts/fixtures/pc-crop-w1-lineage',`${name}.sql`));
      assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),checksum,'REHEARSAL_HISTORICAL_SOURCE_MISMATCH');
      fs.mkdirSync(path.join(historyBootstrap,'migrations',name),{recursive:true});
      fs.writeFileSync(path.join(historyBootstrap,'migrations',name,'migration.sql'),bytes);
      if(index===2) imageDeploy('historical_partial',historyBootstrap);
    }
    imageDeploy('historical',historyBootstrap);
    moveApi('historical_partial');executor('preflight',{error:'ARCHIVED_MIGRATION_SET_INVALID'});
    moveApi('historical');
    const historicalReference=executor();
    assert.equal(historicalReference.PC_W1_ARCHIVED_LEDGER,'EXACT_ARCHIVE');
    assert.equal(historicalReference.PC_W1_LINEAGE_PROFILE,'HISTORICAL');
    expectedHistoricalHash=historicalReference.PC_W1_LINEAGE_CATALOG_SHA256;
    assert.notEqual(expectedHistoricalHash,expectedBaselineHash);
    assert.equal(executor().PC_W1_LINEAGE_CHECKS,'PASS');
    const archiveSql=`SELECT jsonb_agg(to_jsonb(m) ORDER BY migration_name)::text FROM public._prisma_migrations m WHERE migration_name IN (${HISTORICAL_MIGRATIONS.map(([name])=>`'${name}'`).join(',')});`;
    const historyBefore=sql(archiveSql,'historical').stdout;
    sql('CREATE DATABASE historical_guard TEMPLATE historical;');
    sql('ALTER POLICY auction_bids_market_showcase_select ON auction.bids USING (true);','historical_guard');
    moveApi('historical_guard');executor('preflight',{error:'LINEAGE_CATALOG_REFERENCE_MISMATCH'});
    const correction=fs.readFileSync(path.join(migrationRoot,'20260909120000_reconcile_historical_auction_authority/migration.sql'),'utf8');
    const guardFailure=run('docker',['exec','-i',pgId,'psql','-X','--set','ON_ERROR_STOP=1','-U','postgres','-d','historical_guard'],
      {input:correction,allowFailure:true,label:'ISOLATED_CORRECTION_POLICY_GUARD'});
    assert.notEqual(guardFailure.status,0);assert.match(guardFailure.stderr,/W1_LINEAGE_POLICY_DRIFT/);
    assert.equal(sql(archiveSql,'historical_guard').stdout,historyBefore,'REHEARSAL_FAILED_CORRECTION_CHANGED_LEDGER');
    sql('GRANT EXECUTE ON FUNCTION auction.record_admission(text,text,text,text,timestamptz,text,bigint,text,text) TO PUBLIC;','historical');
    moveApi('historical');executor('preflight',{error:'LINEAGE_CATALOG_REFERENCE_MISMATCH'});
    sql('REVOKE EXECUTE ON FUNCTION auction.record_admission(text,text,text,text,timestamptz,text,bigint,text,text) FROM PUBLIC;','historical');
    assert.equal(executor().PC_W1_LINEAGE_CHECKS,'PASS');

    // The reference comes from the exact accepted image executing SQL in a
    // clean isolated database, never from a caller-supplied expected PASS file.
    imageDeploy('reference');moveApi('reference');
    const reference=executor('preflight',{expected:undefined});
    assert.equal(reference.PC_W1_LEGACY_INITIAL_MARKER,'REDUNDANT_SOURCE_MARKER');
    assert.equal(reference.PC_W1_SCHEMA_STRUCTURAL_CHECKS,'OBSERVED_NOT_MATCHED');
    expectedHash=reference.PC_W1_SCHEMA_CATALOG_SHA256;
    assert.match(expectedHash,/^[0-9a-f]{64}$/);
    assert.equal(executor().PC_W1_SCHEMA_STRUCTURAL_CHECKS,'PASS');

    // Alter a real RLS predicate without changing the Prisma ledger. The
    // reference hash must detect this even though every table still has RLS.
    sql('ALTER POLICY inventory_own_read ON inventory.batches USING (true);','reference');
    executor('preflight',{error:'SCHEMA_CATALOG_MISMATCH'});
    sql(`ALTER POLICY inventory_own_read ON inventory.batches USING (
      tenant_id=public.app_identity_tenant_id() AND organization_id=public.app_identity_org_id()
      AND public.app_pc_crop_membership_id() IS NOT NULL);`,'reference');
    assert.equal(executor().PC_W1_SCHEMA_STRUCTURAL_CHECKS,'PASS');
    sql('GRANT SELECT ON inventory.batches TO PUBLIC;','reference');
    executor('preflight',{error:'SCHEMA_CATALOG_MISMATCH'});
    sql('REVOKE SELECT ON inventory.batches FROM PUBLIC;','reference');
    assert.equal(executor().PC_W1_SCHEMA_STRUCTURAL_CHECKS,'PASS');

    moveApi('grainflow','wrong');
    executor('preflight',{error:'API_MIGRATION_DATABASE_IDENTITY_UNPROVEN'});
    moveApi('grainflow','grainflow','mock');
    executor('preflight',{error:'NON_LIVE_INTEGRATION_MODE_ENABLED'});
    const first=Object.keys(TARGET_MIGRATIONS)[0];
    fs.cpSync(path.join(migrationRoot,first),path.join(bootstrap,'migrations',first),{recursive:true});
    imageDeploy('partial',bootstrap);
    moveApi('partial');executor('preflight',{error:'PENDING_SET_NOT_EXACT_EIGHT'});

    moveApi('grainflow');
    const beforeMigration=executor();
    assert.equal(beforeMigration.PC_W1_RESULT,'READY_EXACT_EIGHT');
    assert.equal(beforeMigration.PC_W1_LEGACY_INITIAL_MARKER,'REDUNDANT_SOURCE_MARKER');
    const applied=executor('migrate');
    assert.equal(applied.PC_W1_RESULT,'MIGRATIONS_APPLIED_PENDING_API_ACCEPTANCE');
    assert.equal(applied.PC_W1_SCHEMA_CATALOG_SHA256,expectedHash);
    const repeated=executor('migrate');
    assert.equal(repeated.PC_W1_RESULT,'VERIFIED_ALREADY_APPLIED');assert.equal(repeated.PC_W1_DATABASE_MUTATION,'NONE');
    assert.equal(repeated.PC_W1_LEGACY_INITIAL_MARKER,'REDUNDANT_SOURCE_MARKER');
    for(const name of fs.readdirSync('/root')) if(name.startsWith('pc-w1-backup.') && !backupBefore.has(name)) createdBackups.push(path.join('/root',name));
    assert.equal(createdBackups.length,1,'REHEARSAL_BACKUP_COUNT_INVALID');
    const archive=path.join(createdBackups[0],'database.dump'),bytes=fs.readFileSync(archive);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),applied.PC_W1_BACKUP_SHA256);
    assert.equal(String(bytes.length),applied.PC_W1_BACKUP_BYTES);
    assert.equal(fs.statSync(archive).mode&0o777,0o600);
    sql('CREATE DATABASE restored;');
    run('docker',['exec','-i',pgId,'pg_restore','--exit-on-error','--username=postgres','--dbname=restored'],{input:bytes,label:'ARCHIVE_RESTORE'});
    moveApi('restored');assert.equal(executor().PC_W1_RESULT,'READY_EXACT_EIGHT');
    imageDeploy('restored');
    const restored=executor();assert.equal(restored.PC_W1_RESULT,'VERIFIED_ALREADY_APPLIED');
    assert.equal(restored.PC_W1_SCHEMA_CATALOG_SHA256,expectedHash);
    // No farmer, buyer, session, deal or payment fixtures were introduced.
    // The intentional old API lot-registration degradation stays explicit.
    assert.equal(restored.PC_W1_LEGACY_LOT_ROLLBACK,'DEGRADED_FAIL_CLOSED');
    moveApi('historical');
    const historyApplied=executor('migrate');
    assert.equal(historyApplied.PC_W1_ARCHIVED_LEDGER,'EXACT_ARCHIVE');
    assert.equal(historyApplied.PC_W1_LINEAGE_PROFILE,'CANONICAL');
    assert.equal(historyApplied.PC_W1_LINEAGE_CHECKS,'PASS');
    assert.equal(historyApplied.PC_W1_SCHEMA_CATALOG_SHA256,expectedHash,'REHEARSAL_HISTORICAL_CONVERGENCE_FAILED');
    assert.equal(sql(archiveSql,'historical').stdout,historyBefore,'REHEARSAL_CORRECTION_REWROTE_LEDGER');
    assert.match(sql('SELECT value FROM public.pc_w1_rehearsal_sentinel WHERE id=1;','historical').stdout,/isolated-preservation-proof/);
    const historyRepeated=executor('migrate');
    assert.equal(historyRepeated.PC_W1_RESULT,'VERIFIED_ALREADY_APPLIED');
    assert.equal(historyRepeated.PC_W1_DATABASE_MUTATION,'NONE');
    for(const name of fs.readdirSync('/root')) {
      const directory=path.join('/root',name);
      if(name.startsWith('pc-w1-backup.') && !backupBefore.has(name) && !createdBackups.includes(directory)) createdBackups.push(directory);
    }
    assert.equal(createdBackups.length,2,'REHEARSAL_HISTORICAL_BACKUP_COUNT');
    const historicalArchive=createdBackups.find(directory=>path.join(directory,'database.dump')!==archive);
    const historicalBytes=fs.readFileSync(path.join(historicalArchive,'database.dump'));
    assert.equal(crypto.createHash('sha256').update(historicalBytes).digest('hex'),historyApplied.PC_W1_BACKUP_SHA256);
    sql('CREATE DATABASE historical_restored;');
    run('docker',['exec','-i',pgId,'pg_restore','--exit-on-error','--username=postgres','--dbname=historical_restored'],{input:historicalBytes,label:'HISTORICAL_ARCHIVE_RESTORE'});
    assert.equal(sql(archiveSql,'historical_restored').stdout,historyBefore);
    moveApi('historical_restored');
    assert.equal(executor().PC_W1_LINEAGE_PROFILE,'HISTORICAL');
    imageDeploy('historical_restored');
    assert.equal(executor().PC_W1_SCHEMA_CATALOG_SHA256,expectedHash);
    fs.mkdirSync(path.dirname(report),{recursive:true});
    fs.writeFileSync(report,JSON.stringify({status:'PASS',scope:'ISOLATED_DATABASE_ONLY',targetSha:sha,apiDigest,migrationDigest,postgresDigest:databaseImage,
      expectedCatalogSha256:expectedHash,expectedBaselineCatalogSha256:expectedBaselineHash,expectedHistoricalCatalogSha256:expectedHistoricalHash,
      restoreRehearsal:'PASS',historicalRestoreRehearsal:'PASS',historicalConvergence:'PASS',historicalLedgerPreserved:'PASS',
      negativeCases:{wrongDatabase:'PASS',partialMigration:'PASS',productionMockMode:'PASS',policyDrift:'PASS',grantDrift:'PASS',
        historicalPartial:'PASS',historicalPolicyDrift:'PASS',historicalGrantDrift:'PASS',correctionPolicyGuard:'PASS'},
      fullAcceptance:'NOT_EVIDENCED'},null,2)+'\n',{flag:'wx',mode:0o644});
  } finally {
    if(fs.existsSync(composeFile)) run('docker',['compose','--project-directory',fixture,'--project-name',project,'-f',composeFile,'down','--volumes','--remove-orphans'],{allowFailure:true,label:'DISPOSABLE_CLEANUP'});
    for(const directory of createdBackups) fs.rmSync(directory,{recursive:true,force:true});
    fs.rmSync(fixture,{recursive:true,force:true});
  }
});


// Isolated Docker responses exercise the reused API executor without a daemon.
// They are unit-test fixtures; actual PostgreSQL rehearsal is a separate gate.
test('API digest admission rejects drift and preserves legacy rollback', { timeout: 120_000 }, () => {
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const result=spawnSync('python3',['-c',[
    "#!/usr/bin/env python3",
    "\"\"\"Isolated executor contract tests; all Docker responses are local test fixtures.\"\"\"",
    "import base64",
    "import hashlib",
    "import json",
    "import os",
    "from pathlib import Path",
    "import shutil",
    "import subprocess",
    "import tempfile",
    "",
    "BASE_REPO = Path(os.environ['PC_W1_REUSE_TEST_ROOT'])",
    "REUSE = BASE_REPO",
    "BASE_SHA = 'cba7b580d4f78a972ef562d1b5b5bdd647cd63ed'",
    "EXECUTOR = 'scripts/production-role-eligibility-api-release.sh'",
    "CHECKER = 'scripts/check-role-eligibility-api-release.mjs'",
    "WORKFLOW = '.github/workflows/role-eligibility-production-api-release.yml'",
    "TARGET = 'a' * 40",
    "TARGET_IMAGE = 'ghcr.io/pachaninm-lab/grainflow-api:sha-aaaaaaa'",
    "DIGEST = 'ghcr.io/pachaninm-lab/grainflow-api@sha256:' + 'd' * 64",
    "BASELINE_SOURCE = subprocess.check_output(['git', 'show', f'{BASE_SHA}:{EXECUTOR}'], cwd=BASE_REPO, text=True)",
    "",
    "FAKE_DOCKER = r'''#!/usr/bin/env python3",
    "import json,os,re,sys",
    "from pathlib import Path",
    "p=Path(os.environ['FIXTURE_STATE'])",
    "s=json.loads(p.read_text())",
    "a=sys.argv[1:]",
    "s['calls'].append(a)",
    "def emit(value='', rc=0):",
    "    p.write_text(json.dumps(s))",
    "    if value is not None and value != '': print(value)",
    "    sys.exit(rc)",
    "target='a'*40",
    "target_id='sha256:'+'a'*64",
    "base_id='sha256:'+'b'*64",
    "rogue_id='sha256:'+'c'*64",
    "tag='ghcr.io/pachaninm-lab/grainflow-api:sha-aaaaaaa'",
    "base_tag='ghcr.io/pachaninm-lab/grainflow-api:sha-bbbbbbb'",
    "scenario=s['scenario']",
    "if a[0]=='ps': emit(s['container'])",
    "if a[0]=='pull':",
    "    if '@sha256:' in a[1] and scenario=='digest_pull_failure': emit(rc=1)",
    "    emit()",
    "if a[:2]==['image','inspect']:",
    "    fmt=a[a.index('--format')+1]",
    "    ref=a[-1]",
    "    if '@sha256:' in ref:",
    "        if fmt=='{{.Id}}': emit('not-an-image-id' if scenario=='digest_id_invalid' else target_id)",
    "        emit('b'*40 if scenario=='digest_revision_mismatch' else target)",
    "    if fmt=='{{.Id}}':",
    "        if ref==tag:",
    "            s['tag_id_reads']+=1",
    "            drift={'tag_mismatch_after_pull':1,'tag_mismatch_before_override':2,'tag_mismatch_before_recreate':3}.get(scenario)",
    "            emit(rogue_id if drift and s['tag_id_reads']>=drift else target_id)",
    "        emit(base_id)",
    "    emit('b'*40 if ref in [base_id,base_tag] else target)",
    "if a[0]=='inspect':",
    "    if '--format' in a:",
    "        fmt=a[a.index('--format')+1]",
    "        values={'{{.State.Running}}':'true','{{index .Config.Labels \"com.docker.compose.service\"}}':'api',",
    "                '{{.Config.Image}}':s['image_ref'],'{{.Image}}':s['image_id'],'{{.Id}}':s['container'],'{{.Name}}':'/fixture-api'}",
    "        if fmt not in values: emit('unexpected inspect format',98)",
    "        emit(values[fmt])",
    "    emit(json.dumps([{'Config':{'Env':['NODE_ENV=production'],'Entrypoint':['/nodejs/bin/node'],'Cmd':['main.js'],'User':'1000','WorkingDir':'/app','ExposedPorts':{'3001/tcp':{}}},'HostConfig':{'PortBindings':{'3001/tcp':[{'HostIp':'127.0.0.1','HostPort':'3001'}]},'RestartPolicy':{'Name':'unless-stopped'}},'Mounts':[],'NetworkSettings':{'Networks':{'production':{}}}}]))",
    "if a[0]=='exec':",
    "    if '--runtime-routes' in a:",
    "        check_candidate=s['image_id']==target_id and len(s['up_images'])==1",
    "        if not check_candidate: emit('probe outside candidate boundary',97)",
    "        if scenario=='w1_route_failed': emit('PC_W1_BLOCKER=API_ROUTE_BOUNDARY_FAILED',1)",
    "        if scenario=='w1_route_missing_evidence': emit()",
    "        emit('PC_W1_API_ROUTE_BOUNDARY=PASS\\nPC_W1_API_ROUTES=5\\nPC_W1_AUTHENTICATED_ACCEPTANCE=NOT_EVIDENCED')",
    "    emit()",
    "if a[0]=='compose':",
    "    if 'config' in a:",
    "        if '--quiet' in a: emit()",
    "        if '--services' in a: emit('api')",
    "        override=Path(s['override'])",
    "        emit(override.read_text() if override.exists() else 'services:\\n  api:\\n    image: '+s['image_ref'])",
    "    if 'ps' in a: emit(s['container'])",
    "    if 'up' in a:",
    "        image=re.search(r'image: (\\S+)',Path(s['override']).read_text()).group(1)",
    "        s['up_images'].append(image)",
    "        s['container']=str(1+len(s['up_images']))*64",
    "        s['image_ref']=image",
    "        s['image_id']=base_id if image==base_tag else rogue_id if scenario=='running_digest_mismatch' else target_id",
    "        emit()",
    "emit('unexpected Docker call: '+repr(a),99)",
    "'''",
    "",
    "def check(condition, message):",
    "    if not condition:",
    "        raise AssertionError(message)",
    "",
    "def execute(scenario, action='deploy', digest=DIGEST, source=None):",
    "    with tempfile.TemporaryDirectory(prefix='pc-w1-executor-') as dirname:",
    "        task = Path(dirname)",
    "        binary = task / 'bin'",
    "        binary.mkdir()",
    "        docker = binary / 'docker'",
    "        docker.write_text(FAKE_DOCKER)",
    "        docker.chmod(0o755)",
    "        prod = task / 'production'",
    "        prod.mkdir()",
    "        compose = prod / 'compose.yml'",
    "        compose.write_text('services:\\n  api:\\n    image: fixture\\n')",
    "        override = prod / 'compose.role-eligibility-api-image.override.yml'",
    "        audit = action == 'audit'",
    "        state = {",
    "            'scenario':scenario, 'calls':[], 'container':'1'*64,",
    "            'image_ref':TARGET_IMAGE if audit else 'ghcr.io/pachaninm-lab/grainflow-api:sha-bbbbbbb',",
    "            'image_id':'sha256:' + ('c' if scenario == 'audit_digest_mismatch' else 'a' if audit else 'b')*64,",
    "            'tag_id_reads':0,'up_images':[], 'override':str(override),",
    "        }",
    "        statefile = task / 'state.json'",
    "        statefile.write_text(json.dumps(state))",
    "        env = dict(os.environ, PATH=str(binary)+os.pathsep+os.environ['PATH'], FIXTURE_STATE=str(statefile),",
    "                   PC_ROLE_ELIGIBILITY_API_IMAGE=TARGET_IMAGE if not audit else '',",
    "                   PC_ROLE_ELIGIBILITY_API_DIGEST=digest,",
    "                   PC_ROLE_ELIGIBILITY_W1_ROUTES='invalid' if scenario=='w1_route_invalid_mode' else '1' if scenario.startswith('w1_route_') else '0',",
    "                   PC_PROD_DIR_B64=base64.b64encode(str(prod).encode()).decode(),",
    "                   PC_PROD_COMPOSE_B64=base64.b64encode(str(compose).encode()).decode(),",
    "                   PC_PROD_PROJECT_B64=base64.b64encode(b'production').decode())",
    "        script = REUSE / EXECUTOR",
    "        if source is not None:",
    "            script = task / 'baseline.sh'",
    "            script.write_text(source)",
    "        result = subprocess.run(['bash',str(script),action,TARGET],env=env,capture_output=True,text=True,timeout=15)",
    "        state = json.loads(statefile.read_text())",
    "        state['override_exists'] = override.exists()",
    "        return result, state",
    "",
    "count = 0",
    "negative = [",
    "    ('wrong_repository', 'https://example.invalid@sha256:'+'d'*64, 'API_DIGEST_REFERENCE_INVALID', False),",
    "    ('wrong_namespace', 'ghcr.io/attacker/grainflow-api@sha256:'+'d'*64, 'API_DIGEST_REFERENCE_INVALID', False),",
    "    ('short_digest', DIGEST[:-1], 'API_DIGEST_REFERENCE_INVALID', False),",
    "    ('digest_pull_failure', DIGEST, 'API_DIGEST_PULL_FAILED', False),",
    "    ('digest_id_invalid', DIGEST, 'API_DIGEST_IMAGE_ID_INVALID', False),",
    "    ('digest_revision_mismatch', DIGEST, 'API_DIGEST_REVISION_MISMATCH', False),",
    "    ('tag_mismatch_after_pull', DIGEST, 'API_IMAGE_DIGEST_MISMATCH', False),",
    "    ('tag_mismatch_before_override', DIGEST, 'API_IMAGE_DIGEST_MISMATCH', False),",
    "    ('tag_mismatch_before_recreate', DIGEST, 'API_IMAGE_DIGEST_MISMATCH', True),",
    "    ('running_digest_mismatch', DIGEST, 'DEPLOYED_API_DIGEST_MISMATCH', True),",
    "    ('w1_route_failed', DIGEST, 'W1_API_ROUTE_BOUNDARY_FAILED', True),",
    "    ('w1_route_missing_evidence', DIGEST, 'W1_API_ROUTE_EVIDENCE_INVALID', True),",
    "    ('w1_route_missing_digest', '', 'W1_ROUTE_DIGEST_REQUIRED', False),",
    "    ('w1_route_invalid_mode', DIGEST, 'W1_ROUTE_MODE_INVALID', False),",
    "]",
    "for scenario, digest, error, rollback in negative:",
    "    result,state=execute(scenario,digest=digest)",
    "    check(result.returncode!=0 and f'ERROR_CODE={error}\\n' in result.stdout, f'{scenario}: {result.returncode} {result.stdout} {result.stderr}')",
    "    check('ROLE_ELIGIBILITY_API_RELEASE=PASS' not in result.stdout, f'{scenario}: false success')",
    "    check('ROLE_ELIGIBILITY_API_DIGEST_VERIFIED=PASS' not in result.stdout, f'{scenario}: false digest verification')",
    "    if rollback:",
    "        check('ROLE_ELIGIBILITY_API_ROLLBACK_COMPLETED=1' in result.stdout, f'{scenario}: rollback failed {result.stdout}')",
    "        check(state['image_id']=='sha256:'+'b'*64 and state['up_images'][-1].endswith('sha-bbbbbbb'), f'{scenario}: baseline not restored')",
    "        if scenario=='tag_mismatch_before_recreate': check(len(state['up_images'])==1,f'{scenario}: wrong candidate recreated')",
    "    else:",
    "        check(not state['override_exists'] and not state['up_images'], f'{scenario}: mutated production fixture before admission')",
    "    print(f'PASS runtime negative {scenario}')",
    "    count+=1",
    "",
    "for scenario, action, digest in [('deploy_success','deploy',DIGEST),('w1_route_success','deploy',DIGEST),('audit_success','audit',DIGEST),('audit_digest_mismatch','audit',DIGEST),('audit_legacy','audit',''),('deploy_legacy','deploy','')]:",
    "    result,state=execute(scenario,action,digest)",
    "    if scenario=='audit_digest_mismatch':",
    "        check(result.returncode!=0 and 'ERROR_CODE=API_AUDIT_DIGEST_MISMATCH' in result.stdout and 'ROLE_ELIGIBILITY_API_RELEASE=PASS' not in result.stdout,f'{scenario}: {result.stdout} {result.stderr}')",
    "    else:",
    "        check(result.returncode==0 and 'ROLE_ELIGIBILITY_API_RELEASE=PASS' in result.stdout,f'{scenario}: {result.stdout} {result.stderr}')",
    "        check(('ROLE_ELIGIBILITY_API_DIGEST_VERIFIED=PASS' in result.stdout)==bool(digest),f'{scenario}: incorrect verification claim')",
    "    if scenario=='w1_route_success': check('PC_W1_API_ROUTE_BOUNDARY=PASS' in result.stdout and len(state['up_images'])==1,f'{scenario}: missing route admission')",
    "    if action=='audit': check(not state['override_exists'] and not state['up_images'],f'{scenario}: audit mutated')",
    "    if not digest:",
    "        baseline, baseline_state=execute(scenario,action,digest,BASELINE_SOURCE)",
    "        check((result.returncode,result.stdout,result.stderr)==(baseline.returncode,baseline.stdout,baseline.stderr),f'{scenario}: old-call output semantics changed')",
    "        check(not any('@sha256:' in ' '.join(call) for call in state['calls']),f'{scenario}: legacy unexpectedly touched digest')",
    "        # Temporary paths differ; command shapes and operation order must match.",
    "        normalize=lambda calls: [[part.replace(state['override'].rsplit('/',2)[0],'<TMP>').replace(baseline_state['override'].rsplit('/',2)[0],'<TMP>') for part in call] for call in calls]",
    "        check(normalize(state['calls'])==normalize(baseline_state['calls']),f'{scenario}: old-call Docker operation semantics changed')",
    "    print(f'PASS runtime {scenario}')",
    "    count+=1",
    "",
    "source=(REUSE/EXECUTOR).read_text()",
    "result,state=execute('w1_route_missing_source',source=source)",
    "check(result.returncode!=0 and 'ERROR_CODE=W1_ROUTE_SOURCE_MISSING' in result.stdout and not state['up_images'],'missing route companion did not fail before mutation')",
    "count+=1",
    "baseline_rollback=BASELINE_SOURCE[BASELINE_SOURCE.index('cleanup_on_exit(){'):BASELINE_SOURCE.index(\"trap 'cleanup_on_exit\")]",
    "new_rollback=source[source.index('cleanup_on_exit(){'):source.index(\"trap 'cleanup_on_exit\")]",
    "check(baseline_rollback==new_rollback,'rollback function changed')",
    "print('PASS baseline rollback function byte-identical')",
    "count+=1",
    "",
    "with tempfile.TemporaryDirectory(prefix='pc-w1-checker-') as dirname:",
    "    fixture=Path(dirname)",
    "    (fixture/EXECUTOR).parent.mkdir(parents=True)",
    "    (fixture/WORKFLOW).parent.mkdir(parents=True)",
    "    (fixture/WORKFLOW).write_bytes(subprocess.check_output(['git','show',f'{BASE_SHA}:{WORKFLOW}'],cwd=BASE_REPO))",
    "    checker=REUSE/CHECKER",
    "    def run_checker(text):",
    "        (fixture/EXECUTOR).write_text(text)",
    "        return subprocess.run(['node',str(checker)],cwd=fixture,capture_output=True,text=True)",
    "    result=run_checker(source)",
    "    check(result.returncode==0,f'checker positive: {result.stdout} {result.stderr}')",
    "    print('PASS checker positive')",
    "    count+=1",
    "    mutations={",
    "      'missing_route_rollback_boundary':source.replace('\\nw1_route_boundary \"$new_api_id\"\\n','\\n'),",
    "      'missing_route_complete_evidence':source.replace('|| fail W1_API_ROUTE_EVIDENCE_INVALID 50','|| true'),",
    "      'wrong_digest_repository':source.replace(r'^ghcr\\.io/pachaninm-lab/grainflow-api@sha256:',r'^ghcr\\.io/attacker/grainflow-api@sha256:'),",
    "      'missing_digest_pull':source.replace('docker pull \"$API_DIGEST\" >/dev/null || fail API_DIGEST_PULL_FAILED 40','true'),",
    "      'missing_digest_revision':source.replace('[[ \"$pinned_revision\" == \"$TARGET_SHA\" ]] || fail API_DIGEST_REVISION_MISMATCH 42','true'),",
    "      'missing_tag_id_equality':source.replace('[[ \"$actual_id\" == \"$PINNED_API_IMAGE_ID\" ]] || fail API_IMAGE_DIGEST_MISMATCH 43','true'),",
    "      'missing_first_tag_check':source.replace('\\nassert_api_image_digest\\n\\ncleanup_on_exit(){','\\ncleanup_on_exit(){'),",
    "      'missing_premutation_check':source.replace('assert_api_image_digest\\nMUTATION_STARTED=1','MUTATION_STARTED=1'),",
    "      'missing_prerecreate_check':source.replace('assert_api_image_digest\\n\"${dc_target[@]}\" up','\"${dc_target[@]}\" up'),",
    "      'missing_running_digest_check':source.replace('[[ -z \"$API_DIGEST\" || \"$new_image_id\" == \"$PINNED_API_IMAGE_ID\" ]] || fail DEPLOYED_API_DIGEST_MISMATCH 44','true'),",
    "      'missing_audit_digest_check':source.replace('[[ -z \"$API_DIGEST\" || \"$baseline_image_id\" == \"$PINNED_API_IMAGE_ID\" ]] || fail API_AUDIT_DIGEST_MISMATCH 45','true'),",
    "    }",
    "    for name,mutant in mutations.items():",
    "        check(mutant!=source,f'{name}: inert mutation')",
    "        result=run_checker(mutant)",
    "        check(result.returncode!=0 and 'ROLE_ELIGIBILITY_API_RELEASE_CONTRACT_ERROR=' in result.stderr,f'{name}: checker falsely accepted')",
    "        print(f'PASS checker negative {name}')",
    "        count+=1",
    "",
    "print(f'ISOLATED_CHECKS_PASSED={count}')",
    "print('PRODUCTION_ACCEPTANCE_CREDIT=0')"
  ].join('\n')],{cwd:root,env:{...process.env,PC_W1_REUSE_TEST_ROOT:root},encoding:'utf8',timeout:115_000,maxBuffer:2*1024*1024});
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/ISOLATED_CHECKS_PASSED=34/);
  assert.match(result.stdout,/PRODUCTION_ACCEPTANCE_CREDIT=0/);
});
