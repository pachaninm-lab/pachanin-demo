import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { checkManifests } from './check-ci-postgres-image-authority.mjs';
import { TARGET_MIGRATIONS, TARGET_TABLES, readMigrationManifest, validateManifest, decodeManifest, validateImageManifest,
  classifyLedger, validateApiEnvironment, validateSnapshot, snapshotSql, parseEvidence,
  validateMigrationImage, validateCompose, runtimeFingerprint, errorCode, probeErrorPayload, probeDiagnostics, ledgerDiagnostics, checkSources } from './check-production-pc-crop-w1-acceptance.mjs';

const baseName='20260902204500_role_eligibility_app_deal_api_boundary';
const manifest={ [baseName]:'a'.repeat(64), ...TARGET_MIGRATIONS };
const finished=name=>({ migration_name:name,checksum:manifest[name],finished_at:'2026-09-08T00:00:00Z',rolled_back_at:null });
const target='a'.repeat(40),digest=`ghcr.io/pachaninm-lab/grainflow-migration@sha256:${'b'.repeat(64)}`;
const clone=value=>structuredClone(value);
const rejects=(fn,code)=>assert.throws(fn,error=>error.message===code);
const pre=()=>({ snapshot:'00000003-000001AB-1',nonce:`pc_w1_${'c'.repeat(32)}`,pid:12,databaseOid:42,roleOid:16384,
  decision:'READY_EXACT_SEVEN',pendingCount:7,tables:0,structuralChecks:'NOT_APPLIED',environmentHash:'d'.repeat(64) });
const environment=()=>({ NODE_ENV:'production', ...Object.fromEntries(['DEAL','DOCUMENT','SHIPMENT','LAB','PAYMENT'].map(name=>[`PLATFORM_V7_${name}_REPOSITORY`,'prisma'])) });
const image=()=>({ Id:`sha256:${'e'.repeat(64)}`,RepoDigests:[digest],Config:{User:'nonroot',WorkingDir:'/app',Entrypoint:['/nodejs/bin/node'],
  Cmd:['node_modules/prisma/build/index.js','migrate','deploy','--schema','prisma/schema.prisma'],Labels:{'org.opencontainers.image.revision':target}} });
const compose=()=>({ services:{api:{image:'api'},migration:{image:digest,environment:{DATABASE_URL:'postgresql://isolated.invalid/test'}}} });
const container=(id='f')=>({ Id:id.repeat(64),Image:`sha256:${'a'.repeat(64)}`,State:{Running:true,StartedAt:'2026-09-08T00:00:00Z'},
  Config:{Env:['NODE_ENV=production'],Cmd:['worker'],Labels:{'com.docker.compose.service':'worker'}},HostConfig:{},Mounts:[],NetworkSettings:{Networks:{isolated:{NetworkID:'n',EndpointID:'e',IPAddress:'172.25.0.2'}}} });
const readyEvidence=()=>({PC_W1_TARGET_SHA:target,PC_W1_BASELINE_API_SHA:'b'.repeat(40),PC_W1_DATABASE_IDENTITY:'PASS',
  PC_W1_PENDING_MIGRATIONS:'7',PC_W1_SCHEMA_TABLES:'0',PC_W1_SCHEMA_STRUCTURAL_CHECKS:'NOT_APPLIED',
  PC_W1_API_ENVIRONMENT_SHA256:'c'.repeat(64),PC_W1_NON_API_RUNTIME_SHA256:'d'.repeat(64),PC_W1_RUNTIME_UNCHANGED:'PASS',
  PC_W1_DATABASE_ROLLBACK:'NOT_REHEARSED',PC_W1_DATABASE_MUTATION:'NONE',PC_W1_AUTHENTICATED_ACCEPTANCE:'NOT_EVIDENCED',
  PC_W1_FULL_ACCEPTANCE:'NOT_EVIDENCED',PC_W1_LEGACY_LOT_ROLLBACK:'DEGRADED_FAIL_CLOSED',PC_W1_RESULT:'READY_EXACT_SEVEN'});
const lines=value=>Object.entries(value).map(([key,value])=>`${key}=${value}`).join('\n');

test('only the observed seven accepted checksums may be pending',()=>{
  assert.equal(Object.keys(TARGET_MIGRATIONS).length,7);
  assert.equal(TARGET_TABLES.length,24);
  assert.deepEqual(classifyLedger(manifest,[finished(baseName)]),{decision:'READY_EXACT_SEVEN',pendingCount:7});
  assert.deepEqual(classifyLedger(manifest,Object.keys(manifest).map(finished)),{decision:'VERIFIED_ALREADY_APPLIED',pendingCount:0});
});
for(const name of Object.keys(TARGET_MIGRATIONS)) test(`partial applied set blocks: ${name}`,()=>{
  rejects(()=>classifyLedger(manifest,[finished(baseName),finished(name)]),'PENDING_SET_NOT_EXACT_SEVEN');
});
test('an extra pending migration cannot ride along with accepted seven',()=>{
  rejects(()=>classifyLedger({...manifest,'20260909000000_unaccepted_change':'1'.repeat(64)},[finished(baseName)]),'PENDING_SET_NOT_EXACT_SEVEN');
});
test('older missing migration blocks too',()=>rejects(()=>classifyLedger(manifest,[]),'PENDING_SET_NOT_EXACT_SEVEN'));
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
  assert.deepEqual({...d,SHA256:'HASH'},{ROWS:7,MATCHED:2,DRIFTED:2,UNKNOWN:1,DUPLICATES:2,UNFINISHED:1,ROLLED_BACK:1,LEGACY_INITIAL_MARKERS:1,SHA256:'HASH'});
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
  for(const [key,value] of Object.entries(payload.ledgerDiagnostics)) {
    const changed=structuredClone(payload);changed.ledgerDiagnostics[key]=key==='SHA256'?'secret-path':10001;
    assert.equal(probeErrorPayload({message:changed.error,...changed}).ledgerDiagnostics,undefined);
    rejects(()=>parseEvidence(output.replace(`PC_W1_LEDGER_${key}=${value}\n`,'')+end),'CONTRADICTORY_LEDGER_DIAGNOSTICS');
  }
  rejects(()=>parseEvidence(output.replace('PC_W1_LEDGER_ROWS=1','PC_W1_LEDGER_ROWS=2')+end),'CONTRADICTORY_LEDGER_DIAGNOSTICS');
  rejects(()=>parseEvidence(output+end.replace('MUTATION=NONE','MUTATION=BOUNDED_SEVEN_MIGRATIONS')),'CONTRADICTORY_LEDGER_DIAGNOSTICS');
  rejects(()=>parseEvidence(output+'PC_W1_RESULT=READY_EXACT_SEVEN\n'),'CONTRADICTORY_CHECKSUM_DIAGNOSTICS');
  const changed=structuredClone(payload);changed.checksumDrift.appliedValueSha256='private-value';
  assert.doesNotMatch(probeDiagnostics(changed),/private-value/);
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
  assert.equal(classifyLedger(manifest,[finished(baseName),{...finished(Object.keys(TARGET_MIGRATIONS)[0]),rolled_back_at:'2026-09-08'}]).pendingCount,7);
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
test('actual repository history including the legacy initial migration admits only the exact seven pending',()=>{
  const root=fileURLToPath(new URL('../apps/api/prisma/migrations/',import.meta.url));
  const actual=readMigrationManifest(root);
  assert.ok(Object.keys(actual).length>Object.keys(TARGET_MIGRATIONS).length);
  assert.equal(actual['0001_postgresql_initial'],crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'0001_postgresql_initial/migration.sql'))).digest('hex'));
  validateImageManifest(actual,decodeManifest(Buffer.from(JSON.stringify(actual)).toString('base64')));
  const ledger=Object.entries(actual).filter(([name])=>!Object.hasOwn(TARGET_MIGRATIONS,name)).map(([migration_name,checksum])=>({migration_name,checksum,finished_at:'2026-09-08',rolled_back_at:null}));
  assert.deepEqual(classifyLedger(actual,ledger),{decision:'READY_EXACT_SEVEN',pendingCount:7});
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
    PC_W1_SCHEMA_CATALOG_SHA256:'f'.repeat(64),PC_W1_RESULT:'MIGRATIONS_APPLIED_PENDING_API_ACCEPTANCE',PC_W1_DATABASE_MUTATION:'BOUNDED_SEVEN_MIGRATIONS'};
  rejects(()=>parseEvidence(lines(value)),'MISSING_MUTATION_BACKUP_EVIDENCE');
  parseEvidence(lines({...value,PC_W1_BACKUP_SHA256:'a'.repeat(64),PC_W1_BACKUP_BYTES:'1024',PC_W1_BACKUP_VERIFICATION:'ARCHIVE_LIST_ONLY'}));
});
for(const suffix of ['\n/protected/server/path','\nDATABASE_URL=postgresql://private','\nPC_W1_FULL_ACCEPTANCE=PASS','\nPC_W1_UNKNOWN=PASS','\nPC_W1_RESULT=READY_EXACT_SEVEN']) test(`unsafe or duplicate remote output rejected ${suffix}`,()=>{
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
  let pgId,databaseImage,expectedHash;
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
    for(const database of ['reference','wrong','partial']) sql(`CREATE DATABASE ${database} TEMPLATE grainflow;`);

    // The reference comes from the exact accepted image executing SQL in a
    // clean isolated database, never from a caller-supplied expected PASS file.
    imageDeploy('reference');moveApi('reference');
    const reference=executor('preflight',{expected:undefined});
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
    moveApi('partial');executor('preflight',{error:'PENDING_SET_NOT_EXACT_SEVEN'});

    moveApi('grainflow');
    assert.equal(executor().PC_W1_RESULT,'READY_EXACT_SEVEN');
    const applied=executor('migrate');
    assert.equal(applied.PC_W1_RESULT,'MIGRATIONS_APPLIED_PENDING_API_ACCEPTANCE');
    assert.equal(applied.PC_W1_SCHEMA_CATALOG_SHA256,expectedHash);
    const repeated=executor('migrate');
    assert.equal(repeated.PC_W1_RESULT,'VERIFIED_ALREADY_APPLIED');assert.equal(repeated.PC_W1_DATABASE_MUTATION,'NONE');
    for(const name of fs.readdirSync('/root')) if(name.startsWith('pc-w1-backup.') && !backupBefore.has(name)) createdBackups.push(path.join('/root',name));
    assert.equal(createdBackups.length,1,'REHEARSAL_BACKUP_COUNT_INVALID');
    const archive=path.join(createdBackups[0],'database.dump'),bytes=fs.readFileSync(archive);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),applied.PC_W1_BACKUP_SHA256);
    assert.equal(String(bytes.length),applied.PC_W1_BACKUP_BYTES);
    assert.equal(fs.statSync(archive).mode&0o777,0o600);
    sql('CREATE DATABASE restored;');
    run('docker',['exec','-i',pgId,'pg_restore','--exit-on-error','--username=postgres','--dbname=restored'],{input:bytes,label:'ARCHIVE_RESTORE'});
    moveApi('restored');assert.equal(executor().PC_W1_RESULT,'READY_EXACT_SEVEN');
    imageDeploy('restored');
    const restored=executor();assert.equal(restored.PC_W1_RESULT,'VERIFIED_ALREADY_APPLIED');
    assert.equal(restored.PC_W1_SCHEMA_CATALOG_SHA256,expectedHash);
    // No farmer, buyer, session, deal or payment fixtures were introduced.
    // The intentional old API lot-registration degradation stays explicit.
    assert.equal(restored.PC_W1_LEGACY_LOT_ROLLBACK,'DEGRADED_FAIL_CLOSED');
    fs.mkdirSync(path.dirname(report),{recursive:true});
    fs.writeFileSync(report,JSON.stringify({status:'PASS',scope:'ISOLATED_DATABASE_ONLY',targetSha:sha,apiDigest,migrationDigest,postgresDigest:databaseImage,
      expectedCatalogSha256:expectedHash,restoreRehearsal:'PASS',negativeCases:{wrongDatabase:'PASS',partialMigration:'PASS',productionMockMode:'PASS',policyDrift:'PASS',grantDrift:'PASS'},
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
    "if a[0]=='exec': emit()",
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
    "for scenario, action, digest in [('deploy_success','deploy',DIGEST),('audit_success','audit',DIGEST),('audit_digest_mismatch','audit',DIGEST),('audit_legacy','audit',''),('deploy_legacy','deploy','')]:",
    "    result,state=execute(scenario,action,digest)",
    "    if scenario=='audit_digest_mismatch':",
    "        check(result.returncode!=0 and 'ERROR_CODE=API_AUDIT_DIGEST_MISMATCH' in result.stdout and 'ROLE_ELIGIBILITY_API_RELEASE=PASS' not in result.stdout,f'{scenario}: {result.stdout} {result.stderr}')",
    "    else:",
    "        check(result.returncode==0 and 'ROLE_ELIGIBILITY_API_RELEASE=PASS' in result.stdout,f'{scenario}: {result.stdout} {result.stderr}')",
    "        check(('ROLE_ELIGIBILITY_API_DIGEST_VERIFIED=PASS' in result.stdout)==bool(digest),f'{scenario}: incorrect verification claim')",
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
  assert.match(result.stdout,/ISOLATED_CHECKS_PASSED=26/);
  assert.match(result.stdout,/PRODUCTION_ACCEPTANCE_CREDIT=0/);
});
