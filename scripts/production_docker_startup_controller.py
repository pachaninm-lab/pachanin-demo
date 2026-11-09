"""Bind accepted plaintext sources and a fresh OWNER command; grants no permission."""
import ast, datetime as dt, hashlib, json, os, re, stat, subprocess, sys, textwrap
from pathlib import Path
import urllib.request

WORKFLOW = '.github/workflows/production-docker-headroom-diagnostic.yml'
TEST = 'scripts/test_production_stopped_runtime_headroom.py'
QUEUE = 'docs/platform-v7/execution-queue.md'
HOST = 'scripts/production_docker_startup_host.py'
CONTROLLER = 'scripts/production_docker_startup_controller.py'
COLD = '.github/workflows/production-cold-preservation.yml'
PROMPT = 'docs/platform-v7/autopilot/prompts/current-review-task.md'
SOURCE_PATHS = (WORKFLOW, TEST, HOST, CONTROLLER, COLD)
SOURCE_CAPS = (500000, 262144, 20000, 65536, 262144)
BASE = '753c40593b84325e02555849a2f11e6f4ede61f9'
RETAINED = '8cdc6694cc343437f3f1f341c2a9820faef8ec75'
PREFIX_BYTES = 477440
PREFIX_SHA = '2860b9abd30a929a8e0538f5515f5ea34864d8b5e08cac8910511c296c19b22c'
TEST_SHA = 'ba73a1b698ba48de1085574b0863cf1ae2ea8940dbed1977c34d014c537ab4b9'
PURPOSE = 'docker-startup-cross-contract-repair-20261109'
COMMAND = '/production diagnose-docker-startup-as current-main'
MARKER = '\n## DSA3 — Docker startup cross-contract repair, 2026-11-09\n\n```json\n'
DSA2_MARKER = '\n## DSA2 — Docker startup plaintext recovery, 2026-11-09\n\n```json\n'
ADMISSION_MARKER = '\n## DSA — Docker startup exact source admission, 2026-11-08\n\n```json\n'
PURPOSE_MARKER = '\n## Docker startup address-space comparison purpose 20261108\n\n```json\n'
PREDECESSOR = {
    'admission': {'bytes':7720,'sha256':'da73ded89448edbcdb42d94304d311a1b478398751d83dd383faefc448f60067'},
    'sourcePurpose': {'bytes':18999,'sha256':'7d86b90e6069dad7284b62a42eaf45281c764a4fb3060e1a0d0572c3957b0c3f'},
    'dsa2': {'bytes':3132,'sha256':'442a0d3ac63f45e61f488fac7a516496dccd26052fd37d5b376ed2463d9ce403'}}
SOURCE_REVIEWER = '/root/release_review'
SOURCE_AUTHOR = '/root/model_release'
GOVERNANCE_REVIEWER = '/root/language_release'
GOVERNANCE_AUTHOR = '/root'
BOUNDS = {'maximumTransportsPerCommand':1,'maximumSequentialChildren':2,'argv':['/usr/bin/docker','--version'],
    'profiles':['INHERITED_AS','EXACT_AS_512_MIB'],'addressSpaceBytes':536870912,'commandSeconds':12,
    'comparisonSeconds':15,'transportSeconds':45,'maximumStreamBytes':16384,'commandFreshSeconds':300,
    'cpuSeconds':2,'coreBytes':0,'fileOutputBytes':0,'automaticReruns':0}

def require(value):
    if not value:
        raise ValueError('STARTUP_ADMISSION_REJECTED')

def unique(pairs):
    value = {}
    for key, item in pairs:
        require(key not in value)
        value[key] = item
    return value

def decode(raw):
    return json.loads(raw, object_pairs_hook=unique)

def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False)

def read(path, cap):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC)
    try:
        info = os.fstat(fd)
        require(stat.S_ISREG(info.st_mode) and 0 <= info.st_size <= cap)
        with os.fdopen(fd, 'rb', closefd=False) as handle:
            raw = handle.read(cap+1)
        after = os.fstat(fd)
        require(len(raw) == info.st_size and (info.st_ino,info.st_size,info.st_mtime_ns,info.st_ctime_ns) ==
                (after.st_ino,after.st_size,after.st_mtime_ns,after.st_ctime_ns))
        return raw
    finally:
        os.close(fd)

def pin(path, raw):
    return {'path':path,'mode':'100644','bytes':len(raw),'blob':hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest(),
            'sha256':hashlib.sha256(raw).hexdigest()}

def wire(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False)

def record_block(text, marker, cap):
    require(text.count(marker) == 1)
    part = text.split(marker,1)[1].split('\n```\n',1)
    require(len(part) == 2)
    raw = part[0].encode('utf-8')
    require(0 < len(raw) <= cap)
    value = decode(raw)
    require(type(value) is dict and wire(value).encode() == raw)
    return value, raw

def artifact(value, minimum=1, maximum=1048576):
    require(type(value) is dict and set(value) == {'bytes','sha256'} and
            type(value['bytes']) is int and minimum <= value['bytes'] <= maximum and
            type(value['sha256']) is str and re.fullmatch('[0-9a-f]{64}',value['sha256']))

def review_receipt(r, source):
    keys = {'status','reviewerIdentity','authorIdentity','independent','findings','artifact','comment'}
    require(type(r) is dict and set(r) == keys | ({'kind'} if source else set()))
    require(r['status'] == 'CLEAN_PRIVATE_SOURCE_ONLY' and r['independent'] is True and type(r['findings']) is dict and
            set(r['findings']) == {'P0','P1','P2'} and all(type(n) is int and n == 0 for n in r['findings'].values()))
    require((r['reviewerIdentity'],r['authorIdentity']) ==
            ((SOURCE_REVIEWER,SOURCE_AUTHOR) if source else (GOVERNANCE_REVIEWER,GOVERNANCE_AUTHOR)))
    if source:
        require(r['kind'] == 'PRIVATE_SOURCE_REVIEW')
    artifact(r['artifact'],100,20000)
    receipt = r['comment']
    require(type(receipt) is dict and set(receipt) == {'id','issue','publisher','appId','createdAt'})
    require(type(receipt['id']) is str and re.fullmatch('[1-9][0-9]{0,19}',receipt['id']))
    require(type(receipt['issue']) is int and receipt['issue'] == 5469 and receipt['publisher'] == 'pachaninm-lab')
    require(type(receipt['appId']) is int and receipt['appId'] == 1144995)
    require(type(receipt['createdAt']) is str and re.fullmatch(r'[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z',receipt['createdAt']))
    dt.datetime.fromisoformat(receipt['createdAt'].replace('Z','+00:00'))

def purpose(queue, prompt, sources):
    require(type(queue) is bytes and len(queue) <= 3145728 and type(sources) is dict and tuple(sources) == SOURCE_PATHS)
    require(type(prompt) is bytes and len(prompt) <= 2097152)
    text = queue.decode('utf-8')
    prior = {}
    for name,marker in (('admission',ADMISSION_MARKER),('sourcePurpose',PURPOSE_MARKER),('dsa2',DSA2_MARKER)):
        value,raw = record_block(text,marker,PREDECESSOR[name]['bytes'])
        require(len(raw) == PREDECESSOR[name]['bytes'] and hashlib.sha256(raw).hexdigest() == PREDECESSOR[name]['sha256'])
        prior[name] = value
    old = prior['admission']['core']
    source = prior['sourcePurpose']
    require(canonical(old['sourcePurpose']) == canonical(PREDECESSOR['sourcePurpose']))
    require(canonical(old['bounds']) == canonical(source['bounds']) == canonical(BOUNDS))
    require(canonical([p['after'] for p in old['sourcePayloads']]) == canonical(source['sourcePins']))
    require(source['command'] == COMMAND and source['runtimeAllowance'] == old['runtimeAllowance'] == 'NOT_ISSUED_BY_SOURCE' and
            old['productionInvocationAuthorized'] is False and source['authorityGranted'] == 'SOURCE_PURPOSE_ONLY_SEPARATE_FINITE_OWNER_COMMAND_REQUIRED')
    dsa2 = prior['dsa2']
    require(dsa2['schema'] == 'pc.docker-startup-source-admission.v2' and
            canonical(dsa2['core']['predecessor']) == canonical({k:PREDECESSOR[k] for k in ('admission','sourcePurpose')}) and
            dsa2['core']['runtimeAllowance'] == 'NOT_ISSUED_BY_SOURCE')
    v,_ = record_block(prompt.decode('utf-8'),MARKER,4096)
    require(set(v) == {'schema','core','governanceAfter','governancePatch','governanceReview'} and v['schema'] == 'pc.docker-startup-source-admission.v3')
    core = v['core']
    require(type(core) is dict and set(core) == {'purposeId','authorityBaseExactMain','retainedSourceHead','predecessor',
        'sourceAfter','sourcePatch','sourceReview','runtimeAllowance'})
    require((core['purposeId'],core['authorityBaseExactMain'],core['retainedSourceHead'],core['runtimeAllowance']) ==
        (PURPOSE,BASE,RETAINED,'NOT_ISSUED_BY_SOURCE'))
    require(canonical(core['predecessor']) == canonical(PREDECESSOR))
    require(all(type(sources[p]) is bytes and 0 < len(sources[p]) <= cap for p,cap in zip(SOURCE_PATHS,SOURCE_CAPS)))
    require(canonical(core['sourceAfter']) == canonical([pin(p,sources[p]) for p in SOURCE_PATHS]))
    artifact(core['sourcePatch'])
    review_receipt(core['sourceReview'],True)
    require(type(v['governanceAfter']) is list and len(v['governanceAfter']) == 3)
    for after,before in zip(v['governanceAfter'],dsa2['governanceAfter']):
        require(type(after) is dict and set(after) == {'path','mode','blob','bytes','sha256'})
        require((after['path'],after['mode']) == (before['path'],before['mode']) and type(after['blob']) is str and
                re.fullmatch('[0-9a-f]{40}',after['blob']) and after['blob'] != before['blob'])
        artifact({k:after[k] for k in ('bytes','sha256')})
    artifact(v['governancePatch'])
    review_receipt(v['governanceReview'],False)
    require(core['sourceReview']['comment']['id'] != v['governanceReview']['comment']['id'])
    for current,old_review in ((core['sourceReview'],dsa2['core']['sourceReview']),(v['governanceReview'],dsa2['governanceReview'])):
        require(current['comment']['id'] != old_review['comment']['id'] and
                current['artifact']['sha256'] != old_review['artifact']['sha256'])
    return v

def source_review(record, live):
    r = record['core']['sourceReview']
    review_receipt(r,True)
    receipt = r['comment']
    require(type(live) is dict and type(live['id']) is int and str(live['id']) == receipt['id'])
    require(live['issue_url'] == 'https://api.github.com/repos/pachaninm-lab/pachanin-demo/issues/5469' and
            live['user']['login'] == receipt['publisher'] and live['author_association'] == 'OWNER')
    app = live['performed_via_github_app']['id']
    require(type(app) is int and app == receipt['appId'])
    require(live['created_at'] == live['updated_at'] == receipt['createdAt'] and type(live['body']) is str)
    raw = live['body'].encode('utf-8')
    require(100 <= len(raw) == r['artifact']['bytes'] <= 20000 and hashlib.sha256(raw).hexdigest() == r['artifact']['sha256'])

def restore_dsa2_workflow(raw):
    """Undo exactly three admitted growth checks, then authenticate the entire prior carrier."""
    import hashlib
    old=b"          import hashlib,pathlib,stat\n          path=pathlib.Path('scripts/test_production_stopped_runtime_headroom.py')\n          info=path.lstat()\n          assert stat.S_ISREG(info.st_mode) and not path.is_symlink() and info.st_size == 62220\n          raw=path.read_bytes()\n          assert len(raw) == 62220 and hashlib.sha256(raw).hexdigest() == 'ba73a1b698ba48de1085574b0863cf1ae2ea8940dbed1977c34d014c537ab4b9'\n          raw=raw[:34021]+b'\\n'+raw[62173:]\n          assert len(raw) == 34069 and hashlib.sha256(raw).hexdigest() == '6f3fcdd7662a5027c06a64e9984e00f6fd81ff6beae6c8c8409785f37d30c8f9'\n          assert hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\\0'+raw).hexdigest() == 'bc2c092cea71aaca1c94121b02d1bd87cf83df5f'\n"
    new=b"          import hashlib,pathlib,stat\n          path=pathlib.Path('scripts/test_production_stopped_runtime_headroom.py')\n          info=path.lstat()\n          identities={62220:'ba73a1b698ba48de1085574b0863cf1ae2ea8940dbed1977c34d014c537ab4b9',109142:'0924c1fb5e06f0582411084ac1c57db51a07738b6701ce0327ba93709fc079c7'}\n          assert stat.S_ISREG(info.st_mode) and not path.is_symlink() and info.st_size in identities\n          raw=path.read_bytes()\n          assert len(raw)==info.st_size and hashlib.sha256(raw).hexdigest()==identities[info.st_size]\n          raw=raw[:62220]\n          assert len(raw) == 62220 and hashlib.sha256(raw).hexdigest() == 'ba73a1b698ba48de1085574b0863cf1ae2ea8940dbed1977c34d014c537ab4b9'\n          raw=raw[:34021]+b'\\n'+raw[62173:]\n          assert len(raw) == 34069 and hashlib.sha256(raw).hexdigest() == '6f3fcdd7662a5027c06a64e9984e00f6fd81ff6beae6c8c8409785f37d30c8f9'\n          assert hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\\0'+raw).hexdigest() == 'bc2c092cea71aaca1c94121b02d1bd87cf83df5f'\n"
    if type(raw) is not bytes or raw.count(new)!=3 or raw.count(old)!=0:
        raise ValueError('STARTUP_WORKFLOW_INVERSE_REJECTED')
    restored=raw.replace(new,old)
    if len(restored)!=483004 or hashlib.sha256(restored).hexdigest()!='f902604ce3a86c3e5bb2b9bc40cbbfc02a80c5c6c19b9ff6d0aa2d6949d0438e':
        raise ValueError('STARTUP_WORKFLOW_INVERSE_REJECTED')
    return restored

def sections(sources):
    # Runtime callers supply only accepted_sources() bytes; no new file is opened here.
    require(type(sources) is dict and tuple(sources) == SOURCE_PATHS)
    raw = sources[WORKFLOW]
    retained = restore_dsa2_workflow(raw)
    require(hashlib.sha256(retained[:PREFIX_BYTES]).hexdigest() == PREFIX_SHA)
    require(hashlib.sha256(sources[TEST][:62220]).hexdigest() == TEST_SHA)
    def extract(tag):
        rows = re.findall(rb"^          (?:cat > .*|python3 .*|python3 -) <<'"+tag.encode()+rb"'\n(.*?)^          "+tag.encode()+rb"\n",raw,re.M|re.S)
        require(len(rows) == 1)
        return textwrap.dedent(rows[0].decode())
    old = extract('PY_CLOSED_DOCKER_SIGNAL')
    classes = [n for n in ast.parse(old).body if isinstance(n,ast.ClassDef) and n.name == 'OwnedChildLease']
    require(len(classes) == 1)
    remote = 'import ctypes, os, signal, subprocess, time\n'+ast.get_source_segment(old,classes[0])+'\n'+sources[HOST].decode('utf-8')
    require(len(remote.encode()) <= 20000)
    host = {'__name__':'startup_host_validator'}
    exec(compile(remote,'<accepted-startup-payload>','exec'),host)
    transport = {'__name__':'startup_exact_retained_transport'}
    exec(compile(extract('PY_CLOSED_DOCKER_TRANSPORT'),'<unchanged-accepted-transport>','exec'),transport)
    return raw, remote, host, transport

def git(*args):
    result = subprocess.run(['git','--no-replace-objects',*args],stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,timeout=10,env={**os.environ,'GIT_NO_LAZY_FETCH':'1','GIT_OPTIONAL_LOCKS':'0'})
    require(result.returncode == 0)
    return result.stdout

def accepted_blob(target,path,cap):
    fields = git('ls-tree',target,'--',path).decode().strip().split()
    require(len(fields) == 4 and fields[:2] == ['100644','blob'] and fields[3] == path and re.fullmatch('[0-9a-f]{40}',fields[2]))
    length = git('cat-file','-s',fields[2]).strip()
    require(re.fullmatch(rb'[0-9]{1,8}',length) and int(length) <= cap)
    raw = git('cat-file','blob',fields[2])
    require(len(raw) == int(length) and pin(path,raw)['blob'] == fields[2] and read(path,cap) == raw)
    require(not os.lstat(path).st_mode & 0o111)
    return raw

def accepted_sources(target):
    require(type(target) is str and re.fullmatch('[0-9a-f]{40}',target) and git('rev-parse','HEAD').decode().strip() == target)
    sources = {p:accepted_blob(target,p,cap) for p,cap in zip(SOURCE_PATHS,SOURCE_CAPS)}
    record = purpose(accepted_blob(target,QUEUE,3145728),accepted_blob(target,PROMPT,2097152),sources)
    git('merge-base','--is-ancestor',BASE,target)
    git('merge-base','--is-ancestor',RETAINED,target)
    return sources,record

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):
        return None

def api(path):
    require(path in ('git/ref/heads/main','issues/4637') or re.fullmatch(r'issues/comments/[1-9][0-9]{0,19}',path))
    request = urllib.request.Request('https://api.github.com/repos/pachaninm-lab/pachanin-demo/'+path,
        headers={'Authorization':'Bearer '+os.environ['GH_TOKEN'],'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'})
    with urllib.request.build_opener(NoRedirect).open(request,timeout=10) as response:
        require(response.status == 200)
        raw = response.read(65537)
        require(len(raw) <= 65536)
    return decode(raw)

def owner(event,live,now):
    require(type(event) is dict and event.get('action') == 'created' and event['issue']['number'] == 4637 and 'pull_request' not in event['issue'])
    prior = event['comment']
    require(type(prior['id']) is int and prior['id'] > 0 and type(live['id']) is int and live['id'] == prior['id'])
    require(live['issue_url'] == 'https://api.github.com/repos/pachaninm-lab/pachanin-demo/issues/4637')
    require(prior['body'] == live['body'] == COMMAND and live['user']['login'] == prior['user']['login'] == 'pachaninm-lab')
    require(live['author_association'] == prior['author_association'] == 'OWNER')
    require(live['created_at'] == live['updated_at'] == prior['created_at'] == prior['updated_at'])
    require(re.fullmatch(r'[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z',live['created_at']))
    stamp = dt.datetime.fromisoformat(live['created_at'].replace('Z','+00:00'))
    require(0 <= (now-stamp).total_seconds() <= 255)
    direct = os.environ['GITHUB_ACTOR'] == os.environ['TRIGGERING_ACTOR'] == 'pachaninm-lab'
    app = (live.get('performed_via_github_app') or {}).get('id')
    prior_app = (prior.get('performed_via_github_app') or {}).get('id')
    require(direct or type(app) is int and type(prior_app) is int and app == prior_app == 1144995)
    return str(prior['id'])

def admit():
    require(os.environ['GITHUB_REPOSITORY'] == 'pachaninm-lab/pachanin-demo' and
            os.environ['GITHUB_EVENT_NAME'] == 'issue_comment' and os.environ['GITHUB_RUN_ATTEMPT'] == '1' and
            os.environ['GITHUB_REF'] == 'refs/heads/main')
    target = os.environ['GITHUB_SHA']
    require(re.fullmatch('[0-9a-f]{40}',target) and target == os.environ['GITHUB_WORKFLOW_SHA'] == git('rev-parse','HEAD').decode().strip())
    require(os.environ['GITHUB_WORKFLOW_REF'] == 'pachaninm-lab/pachanin-demo/'+WORKFLOW+'@refs/heads/main')
    sources,record = accepted_sources(target)
    prepared = sections(sources)
    event = decode(read(os.environ['GITHUB_EVENT_PATH'],1048576))
    identifier = event['comment']['id']
    require(type(identifier) is int and 0 < identifier < 10**20)
    owner(event,api('issues/comments/'+str(identifier)),dt.datetime.now(dt.timezone.utc))
    source_review(record,api('issues/comments/'+record['core']['sourceReview']['comment']['id']))
    issue = api('issues/4637')
    require(issue['state'] == 'open' and 'pull_request' not in issue and type(issue['comments']) is int and 0 <= issue['comments'] < 2500)
    ref = api('git/ref/heads/main')
    require(ref['ref'] == 'refs/heads/main' and ref['object']['type'] == 'commit' and ref['object']['sha'] == target)
    # Freshness is checked again after all network/source work, before any protected transport.
    owner(event,api('issues/comments/'+str(identifier)),dt.datetime.now(dt.timezone.utc))
    return target,prepared

def publish(target,path,host):
    v = decode(read(path,4096))
    require(type(v) is dict and set(v) == {'schema','target','transport_status','diagnostic','passed',
        'production_mutation','deployment_authorized','local_cleanup_attestation'})
    require(v['schema'] == 'pc.closed-docker-diagnostic-envelope.v2' and v['target'] == target and
        v['production_mutation'] is False and v['deployment_authorized'] is False and type(v['passed']) is bool)
    require(v['local_cleanup_attestation'] in {'NOT_STARTED','OWNED_ANCESTRY_REAPED','NOT_ATTESTED'})
    require(v['transport_status'] in {'UNKNOWN','TIMED_OUT','OUTPUT_LIMIT','NONZERO','INVALID_REMOTE_REPORT','CLEANUP_UNCONFIRMED','VALIDATED_REMOTE_REPORT'})
    require((v['transport_status'] == 'CLEANUP_UNCONFIRMED') == (v['local_cleanup_attestation'] == 'NOT_ATTESTED'))
    if v['transport_status'] == 'VALIDATED_REMOTE_REPORT':
        report = host['validate_report'](v['diagnostic'])
        require(v['local_cleanup_attestation'] == 'OWNED_ANCESTRY_REAPED' and v['passed'] == (report['status'] == 'SUCCESS'))
    else:
        require(v['diagnostic'] is None and not v['passed'])
    return v

def main(mode):
    require(mode in {'--admit','--key-script','--run','--publish'})
    if mode in {'--admit','--run'}:
        target,prepared = admit()
    else:
        target = os.environ['GITHUB_SHA']
        sources,_ = accepted_sources(target)
        prepared = sections(sources)
    workflow,remote,host,transport = prepared
    if mode == '--key-script':
        job = workflow.decode().split('\n  diagnose:\n',1)[1].split('\n\n  inspect:\n',1)[0]
        block = job.split('      - name: Resolve protected key and pinned VPS identity\n',1)[1].split('      - name:',1)[0]
        print(textwrap.dedent(block.split('        run: |\n',1)[1]),end='')
        return 0
    if mode == '--admit':
        return 0
    path = Path(os.environ['RUNNER_TEMP'])/'docker-startup-candidate.json'
    if mode == '--run':
        v = transport['execute'](remote,target,path)
        return 0 if v['passed'] else 1
    require(mode == '--publish' and re.fullmatch('[0-9a-f]{40}',target))
    v = publish(target,path,host)
    out = Path('artifacts/docker-startup-address-space')
    out.mkdir(parents=True,exist_ok=True)
    (out/'closed-result.json').write_text(json.dumps(v,sort_keys=True,separators=(',',':'))+'\n')
    diagnostic = v['diagnostic']
    result = diagnostic['comparison'] if diagnostic is not None else 'NOT_PROVEN'
    with open(os.environ['GITHUB_STEP_SUMMARY'],'a') as handle:
        handle.write('## Daemon-free Docker startup comparison\n\nExact source: `'+target+'`. Result: `'+result+'`.\n\n'+
            'Only fixed --version startup was measured. Production Docker daemon/original19/root cause/DB/restore/API delivery remain NOT_ATTESTED or NOT_ESTABLISHED. No automatic retry or release authorization.\n')
    return 0

if __name__ == '__main__':
    try:
        require(len(sys.argv) == 2)
        raise SystemExit(main(sys.argv[1]))
    except Exception:
        print('STARTUP_DIAGNOSTIC_NOT_PROVEN; NO_RETRY_OR_RELEASE_AUTHORITY',file=sys.stderr)
        raise SystemExit(1) from None
