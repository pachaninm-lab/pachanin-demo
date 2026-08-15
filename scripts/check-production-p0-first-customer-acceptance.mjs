import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ACCEPTANCE='scripts/production-p0-first-customer-acceptance.sh';
const CORE_BLOB='b02ce590dc308ce46c41df33416dd7b11700ae98';
const CHECKER_BLOB='5b315be49d4f7025069441a5ff551729dbc46d36';
const fail=(m)=>{ throw new Error(`P0_FIRST_CUSTOMER_ALIAS_CONTRACT: ${m}`); };
const run=(cmd,args,opts={})=>{
  const r=spawnSync(cmd,args,{encoding:'utf8',...opts});
  if(r.status!==0) fail(`${cmd} failed: ${(r.stderr||r.stdout||'').trim().slice(0,600)}`);
  return r.stdout;
};

const wrapper=fs.readFileSync(ACCEPTANCE,'utf8');
for(const marker of [
  `CORE_BLOB='${CORE_BLOB}'`,
  "'pc_auth_runtime', 'one_deal_auth', 'app_auth', 'app_service'",
  'AUTH_ROLE_ALLOWLIST',
  'AUTH_ROLE_OUTPUT_GUARD',
  'IMAP_IDNA_TARGET',
  'IMAP_IDNA_RECIPIENTS',
  'REMOTE_BLOCKER_PERSIST',
  'REMOTE_BLOCKER_RECOVER',
  '$TMP_ROOT/remote-blocker',
  'REMOTE_BLOCKER_BOUNDARY_CARDINALITY_INVALID',
  'def canonical_mailbox(value):',
  "domain.encode('idna').decode('ascii').lower()",
  'PC_P0_FIRST_CUSTOMER_ALIAS_VALIDATE_ONLY',
  'P0_FIRST_CUSTOMER_IMAP_IDNA_PATCH=PASS',
  'P0_FIRST_CUSTOMER_REMOTE_BLOCKER_PROPAGATION=PASS',
]) if(!wrapper.includes(marker)) fail(`wrapper marker missing: ${marker}`);

const validation=spawnSync('bash',[ACCEPTANCE],{
  encoding:'utf8',
  env:{...process.env,PC_P0_FIRST_CUSTOMER_ALIAS_VALIDATE_ONLY:'1'},
});
if(validation.status!==0
  || !validation.stdout.includes('P0_FIRST_CUSTOMER_AUTH_ALIAS_PATCH=PASS')
  || !validation.stdout.includes('P0_FIRST_CUSTOMER_IMAP_IDNA_PATCH=PASS')
  || !validation.stdout.includes('P0_FIRST_CUSTOMER_REMOTE_BLOCKER_PROPAGATION=PASS')) {
  fail(`wrapper validation failed: ${(validation.stderr||validation.stdout||'').trim().slice(0,600)}`);
}

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pc-p0-first-customer-contract-'));
const oldChecker=path.join(dir,'checker.mjs');
const oldAcceptance=path.join(dir,'acceptance.sh');
try {
  fs.writeFileSync(oldChecker,run('git',['cat-file','blob',CHECKER_BLOB]));
  fs.writeFileSync(oldAcceptance,run('git',['cat-file','blob',CORE_BLOB]));
  if(run('git',['hash-object',oldAcceptance]).trim()!==CORE_BLOB) fail('historical acceptance blob mismatch');
  if(run('git',['hash-object',oldChecker]).trim()!==CHECKER_BLOB) fail('historical checker blob mismatch');

  const current=fs.readFileSync(ACCEPTANCE);
  try {
    fs.copyFileSync(oldAcceptance,ACCEPTANCE);
    const historical=spawnSync(process.execPath,[oldChecker],{encoding:'utf8'});
    if(historical.status!==0) fail(`historical contract failed: ${(historical.stderr||historical.stdout||'').trim().slice(0,1200)}`);
  } finally {
    fs.writeFileSync(ACCEPTANCE,current);
  }
} finally {
  fs.rmSync(dir,{recursive:true,force:true});
}

const restored=fs.readFileSync(ACCEPTANCE,'utf8');
if(!restored.includes("'app_service'")) fail('wrapper restore failed');
if(!restored.includes('REMOTE_BLOCKER_PERSIST') || !restored.includes('REMOTE_BLOCKER_RECOVER')) {
  fail('remote blocker propagation wrapper restore failed');
}
console.log('P0_FIRST_CUSTOMER_ACCEPTANCE_CONTRACT=PASS');
console.log('P0_FIRST_CUSTOMER_AUTH_ALIAS_COMPATIBILITY=HARDENED_LEGACY_APP_SERVICE');
console.log('P0_FIRST_CUSTOMER_IMAP_RECIPIENT_CANONICALIZATION=IDNA_ASCII');
console.log('P0_FIRST_CUSTOMER_REMOTE_BLOCKER_PROPAGATION=SHARED_TMP_FAIL_CLOSED');
