#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

TARGET_SHA="${1:-}"
RUN_ID="${2:-}"
REQUIRED_KB=$((5 * 1024 * 1024))
TARGET_KB=$((6 * 1024 * 1024))

fail(){ printf 'ERROR_CODE=%s\n' "$1" >&2; exit "${2:-1}"; }
[[ "$(id -u)" -eq 0 ]] || fail ROOT_AUTHORITY_REQUIRED 2
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || fail INVALID_TARGET_SHA 3
[[ "$RUN_ID" =~ ^[0-9]{1,20}$ ]] || fail INVALID_RUN_ID 4
command -v docker >/dev/null 2>&1 || fail DOCKER_UNAVAILABLE 5
command -v python3 >/dev/null 2>&1 || fail PYTHON_UNAVAILABLE 6
command -v df >/dev/null 2>&1 || fail DF_UNAVAILABLE 7
docker version >/dev/null 2>&1 || fail DOCKER_DAEMON_UNAVAILABLE 8
[[ "$(docker info --format '{{.DockerRootDir}}')" == /var/lib/docker ]] || fail DOCKER_STORAGE_ROOT_MISMATCH 9
[[ -d /var/lib/docker && ! -L /var/lib/docker ]] || fail DOCKER_STORAGE_ROOT_INVALID 10

report="$(mktemp)"
trap 'rm -f "$report"' EXIT
set +e
python3 - "$TARGET_SHA" "$RUN_ID" "$report" "$REQUIRED_KB" "$TARGET_KB" <<'PY_RECLAIM'
import json,re,subprocess,sys
from collections import defaultdict
from pathlib import Path

target_sha,run_id,report_path,required_raw,target_raw=sys.argv[1:]
required_kb,target_kb=int(required_raw),int(target_raw)
tag_re=re.compile(r'^ghcr[.]io/pachaninm-lab/grainflow-(api|web|migration|tai):[A-Za-z0-9_.-]+$')
digest_re=re.compile(r'^ghcr[.]io/pachaninm-lab/grainflow-(api|web|migration|tai)@sha256:[0-9a-f]{64}$')
id_re=re.compile(r'^sha256:[0-9a-f]{64}$')
allowed={'api','web','migration'}

def cmd(a,check=True):
 r=subprocess.run(a,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 if check and r.returncode: raise RuntimeError('command_failed:'+':'.join(a[:2]))
 return r

def available_kb():
 rows=[x.split() for x in cmd(['df','-Pk','--','/var/lib/docker']).stdout.splitlines() if x.strip()]
 if len(rows)!=2 or len(rows[1])<4 or not rows[1][3].isdigit(): raise RuntimeError('docker_df_invalid')
 return int(rows[1][3])

def inspect(image_id):
 r=cmd(['docker','image','inspect',image_id],False)
 if r.returncode:return None
 value=json.loads(r.stdout)
 if len(value)!=1 or not isinstance(value[0],dict):raise RuntimeError('image_inspect_ambiguous')
 return value[0]

def refs(item):
 out=[]
 for key in ('RepoTags','RepoDigests'):
  values=item.get(key) or []
  if not isinstance(values,list):return None
  for value in values:
   if not isinstance(value,str):return None
   if value and value not in ('<none>','<none>:<none>'):out.append(value)
 return tuple(sorted(set(out)))

def classify(item):
 values=refs(item)
 if values is None or not values:return None
 components=set()
 for ref in values:
  match=tag_re.fullmatch(ref) or digest_re.fullmatch(ref)
  if not match:return None
  components.add(match.group(1))
 if len(components)!=1:return None
 component=next(iter(components))
 return (component,values) if component in allowed else None

def container_images():
 result=set()
 for cid in (x.strip() for x in cmd(['docker', 'ps', '-aq', '--no-trunc']).stdout.splitlines() if x.strip()):
  value=json.loads(cmd(['docker','inspect',cid]).stdout)
  if len(value)!=1:raise RuntimeError('container_inspect_ambiguous')
  image_id=str(value[0].get('Image') or '')
  if not id_re.fullmatch(image_id):raise RuntimeError('container_image_id_invalid')
  result.add(image_id)
 return result

def attest(image_id,component):
 if image_id in container_images():return None,'CONTAINER_REFERENCE'
 item=inspect(image_id)
 if item is None:return None,None
 config=item.get('Config') if isinstance(item.get('Config'),dict) else {}
 labels=config.get('Labels') if isinstance(config.get('Labels'),dict) else {}
 if labels.get('org.opencontainers.image.revision')==target_sha:return None,'TARGET_REVISION'
 current=refs(item)
 if current is None:return None,'UNEXPECTED_REFERENCE_STATE'
 if current:
  state=classify(item)
  if state is None or state[0]!=component:return None,'UNEXPECTED_REFERENCE_STATE'
 return item,None

before=available_kb(); protected=container_images(); container_count=len(protected); records=[]
image_ids=sorted({x.strip() for x in cmd(['docker','image','ls','-q','--no-trunc']).stdout.splitlines() if x.strip()})
for image_id in image_ids:
 if not id_re.fullmatch(image_id):continue
 item=inspect(image_id)
 if item is None:continue
 state=classify(item)
 if state is None:continue
 component,image_refs=state
 config=item.get('Config') if isinstance(item.get('Config'),dict) else {}
 labels=config.get('Labels') if isinstance(config.get('Labels'),dict) else {}
 revision=labels.get('org.opencontainers.image.revision')
 created=str(item.get('Created') or ''); size=item.get('Size')
 if not created or not isinstance(size,int) or size<0:continue
 records.append({'id':image_id,'component':component,'refs':image_refs,'revision':revision,'created':created})
 if revision == target_sha:protected.add(image_id)

by_component=defaultdict(list)
for row in records:by_component[row['component']].append(row)
for rows in by_component.values():
 for row in sorted(rows,key=lambda x:x['created'],reverse=True)[:2]:protected.add(row['id'])
eligible=[row for row in records if row['id'] not in protected]
eligible.sort(key=lambda x:(x['created'],x['component'],x['id']),reverse=True)
attempted=removed_refs=deleted=skipped=0; failures=defaultdict(int)
for row in eligible:
 if available_kb()>=target_kb:break
 attempted+=1; removed=False
 for _ in range(128):
  item,error=attest(row['id'],row['component'])
  if error:failures[error]+=1;break
  if item is None:deleted+=1;removed=True;break
  current=refs(item)
  if current is None:failures['UNEXPECTED_REFERENCE_STATE']+=1;break
  if current:
   result=cmd(['docker', 'image', 'rm', current[0]],False)
   if result.returncode:failures['REFERENCE_REMOVE_FAILED']+=1;break
   removed_refs+=1
   continue
  result=cmd(['docker', 'image', 'rm', row['id']],False)
  if result.returncode:failures['IMAGE_REMOVE_FAILED']+=1;break
  if inspect(row['id']) is None:deleted+=1;removed=True
  else:failures['STILL_PRESENT']+=1
  break
 else:failures['BOUNDED_LOOP_EXHAUSTED']+=1
 if not removed:skipped+=1

after=available_kb(); payload={
 'schemaVersion':'pc.production-docker-headroom-recovery.v1','targetSha':target_sha,'runId':int(run_id),
 'mode':'BOUNDED_UNUSED_CANONICAL_IMAGE_RECLAIM','deleteAuthority':'CANONICAL_REFERENCE_OR_FULL_IMAGE_ID_NO_FORCE',
 'reclaimComponents':sorted(allowed),'requiredAvailableKb':required_kb,'targetAvailableKb':target_kb,
 'beforeAvailableKb':before,'afterAvailableKb':after,'canonicalImageCount':len(records),
 'eligibleImageCount':len(eligible),'containerProtectedImageCount':container_count,'protectedImageCount':len(protected),
 'attemptedImageCount':attempted,'removedReferenceCount':removed_refs,'deletedImageCount':deleted,
 'skippedImageCount':skipped,'removeFailureCounts':dict(sorted(failures.items())),
 'reclaimedBytes':max(0,after-before)*1024,'targetReached':after>=target_kb,'passed':after>=required_kb}
Path(report_path).write_text(json.dumps(payload,separators=(',',':'))+'\n',encoding='utf-8')
if not payload['passed']:raise SystemExit(91)
PY_RECLAIM
rc=$?
set -e
[[ -s "$report" && ! -L "$report" ]] || fail DOCKER_HEADROOM_EVIDENCE_MISSING 11
python3 - "$report" "$TARGET_SHA" "$RUN_ID" "$REQUIRED_KB" "$TARGET_KB" <<'PY_VALIDATE'
import json,sys
path,sha,run_id,required_raw,target_raw=sys.argv[1:]
v=json.load(open(path,encoding='utf-8'))
assert v['schemaVersion']=='pc.production-docker-headroom-recovery.v1'
assert v['targetSha']==sha and v['runId']==int(run_id)
assert v['mode']=='BOUNDED_UNUSED_CANONICAL_IMAGE_RECLAIM'
assert v['deleteAuthority']=='CANONICAL_REFERENCE_OR_FULL_IMAGE_ID_NO_FORCE'
assert v['reclaimComponents']==['api','migration','web']
assert v['requiredAvailableKb']==int(required_raw) and v['targetAvailableKb']==int(target_raw)
for key in ('beforeAvailableKb','afterAvailableKb','canonicalImageCount','eligibleImageCount','containerProtectedImageCount','protectedImageCount','attemptedImageCount','removedReferenceCount','deletedImageCount','skippedImageCount','reclaimedBytes'):
 assert isinstance(v[key],int) and v[key]>=0
assert isinstance(v['removeFailureCounts'],dict)
assert v['targetReached']==(v['afterAvailableKb']>=v['targetAvailableKb'])
assert v['passed']==(v['afterAvailableKb']>=v['requiredAvailableKb'])
PY_VALIDATE
python3 - "$report" <<'PY_EMIT'
import json,sys
v=json.load(open(sys.argv[1],encoding='utf-8'))
keys=(('BEFORE_KB','beforeAvailableKb'),('AFTER_KB','afterAvailableKb'),('REQUIRED_KB','requiredAvailableKb'),('TARGET_KB','targetAvailableKb'),('CANONICAL_IMAGES','canonicalImageCount'),('ELIGIBLE_IMAGES','eligibleImageCount'),('ATTEMPTED_IMAGES','attemptedImageCount'),('REMOVED_REFERENCES','removedReferenceCount'),('DELETED_IMAGES','deletedImageCount'),('SKIPPED_IMAGES','skippedImageCount'),('RECLAIMED_BYTES','reclaimedBytes'))
for label,key in keys:print(f'DOCKER_HEADROOM_{label}={v[key]}')
print('DOCKER_HEADROOM_DELETE_AUTHORITY='+v['deleteAuthority'])
for key,count in sorted(v['removeFailureCounts'].items()):print(f'DOCKER_HEADROOM_REMOVE_FAILURE_{key}={count}')
print('DOCKER_HEADROOM_TARGET_REACHED='+str(v['targetReached']).lower())
print('DOCKER_HEADROOM_RECOVERY='+('PASS' if v['passed'] else 'FAIL'))
PY_EMIT
(( rc == 0 )) || fail DOCKER_HEADROOM_INSUFFICIENT_SAFE_RECLAIM 12
