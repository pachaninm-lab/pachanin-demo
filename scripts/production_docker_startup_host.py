"""Two fixed daemon-free startup measurements; no inventory or release admission."""
import ctypes, hashlib, json, os, re, resource, selectors, signal, stat, subprocess, time

SCHEMA = 'pc.docker-startup-address-space.v1'
ARGV = ('/usr/bin/docker', '--version')
ENV = {'PATH': '/usr/sbin:/usr/bin:/sbin:/bin', 'LC_ALL': 'C'}
AS_BYTES = 536870912
MAX_STREAM = 16384
COMMAND_SECONDS = 12
OUTER_SECONDS = 15
PROFILES = ('INHERITED_AS', 'EXACT_AS_512_MIB')
ROW_STATES = {'NOT_RUN', 'SUCCESS', 'NONZERO', 'TIMED_OUT', 'OUTPUT_LIMIT', 'UNKNOWN', 'CLEANUP_UNCONFIRMED'}
CLEANUP = {'NOT_STARTED', 'OWNED_ANCESTRY_REAPED', 'NOT_ATTESTED'}
SIGNALS = {'NONE', 'GO_PAGE_SUMMARY_RESERVATION_FAILED', 'UNCLASSIFIED'}

def require(value):
    if not value:
        raise ValueError('STARTUP_CLOSED_REJECTED')

def fingerprint(value):
    return tuple(getattr(value, key) for key in ('st_dev', 'st_ino', 'st_mode', 'st_uid',
        'st_gid', 'st_size', 'st_mtime_ns', 'st_ctime_ns'))

def trusted_identity():
    parents = [os.lstat(p) for p in ('/', '/usr', '/usr/bin')]
    require(all(stat.S_ISDIR(p.st_mode) and p.st_uid == 0 and not p.st_mode & 0o022 for p in parents))
    cli = os.lstat(ARGV[0])
    require(stat.S_ISREG(cli.st_mode) and cli.st_uid == 0 and not cli.st_mode & 0o022 and cli.st_mode & 0o111)
    return tuple(map(fingerprint, parents + [cli]))

def failure_signal(raw, complete):
    require(type(raw) is bytes and len(raw) <= MAX_STREAM + 1 and type(complete) is bool)
    if not complete or len(raw) > MAX_STREAM:
        return 'UNCLASSIFIED'
    if b'fatal error: failed to reserve page summary memory' in raw:
        return 'GO_PAGE_SUMMARY_RESERVATION_FAILED'
    return 'NONE' if not raw else 'UNCLASSIFIED'

def empty_row(profile):
    return {'profile': profile, 'status': 'NOT_RUN', 'exit_code': None, 'signal': None,
        'elapsed_ms': 0, 'stdout_captured_bytes': 0, 'stderr_captured_bytes': 0,
        'stdout_eof': False,
        'stderr_eof': False, 'failure_signal': 'UNCLASSIFIED', 'cleanup_attestation': 'NOT_STARTED'}

def child_limits(parent, capped):
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    current_cpu = resource.getrlimit(resource.RLIMIT_CPU)
    cpu = min([2] + [n for n in current_cpu if n != resource.RLIM_INFINITY])
    resource.setrlimit(resource.RLIMIT_CPU, (cpu, cpu))
    resource.setrlimit(resource.RLIMIT_FSIZE, (0, 0))
    if capped:
        resource.setrlimit(resource.RLIMIT_AS, (AS_BYTES, AS_BYTES))
        require(resource.getrlimit(resource.RLIMIT_AS) == (AS_BYTES, AS_BYTES))
    require(ctypes.CDLL(None, use_errno=True).prctl(1, signal.SIGKILL, 0, 0, 0) == 0 and os.getppid() == parent)

def run_profile(profile, deadline, last):
    started = time.monotonic()
    value = empty_row(profile)
    work_end = min(started + COMMAND_SECONDS, deadline - (1 if last else 2))
    if work_end <= started:
        return value
    proc = lease = None
    mux = selectors.DefaultSelector()
    streams = {'out': bytearray(), 'err': bytearray()}
    eof = {'out': False, 'err': False}
    parent = os.getpid()
    try:
        lease = OwnedChildLease()
        proc = subprocess.Popen(ARGV, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
            stderr=subprocess.PIPE, env=ENV, cwd='/', close_fds=True, start_new_session=True,
            preexec_fn=lambda: child_limits(parent, profile == PROFILES[1]))
        for stream, name in ((proc.stdout, 'out'), (proc.stderr, 'err')):
            os.set_blocking(stream.fileno(), False)
            mux.register(stream, selectors.EVENT_READ, name)
        while mux.get_map():
            remaining = work_end - time.monotonic()
            if remaining <= 0:
                value['status'] = 'TIMED_OUT'
                break
            for key, _ in mux.select(min(remaining, .05)):
                try:
                    raw = os.read(key.fd, min(4096, MAX_STREAM + 1 - len(streams[key.data])))
                except BlockingIOError:
                    continue
                if not raw:
                    eof[key.data] = True
                    mux.unregister(key.fileobj)
                else:
                    streams[key.data].extend(raw)
                    if len(streams[key.data]) > MAX_STREAM:
                        value['status'] = 'OUTPUT_LIMIT'
                        break
            if value['status'] == 'OUTPUT_LIMIT':
                break
        else:
            code = lease.wait_without_reap(proc, work_end)
            value.update(status='SUCCESS' if code == 0 else 'NONZERO',
                         exit_code=code if code >= 0 else None, signal=-code if code < 0 else None)
    except subprocess.TimeoutExpired:
        value['status'] = 'TIMED_OUT'
    except (OSError, ValueError, subprocess.SubprocessError):
        value['status'] = 'UNKNOWN'
    finally:
        mux.close()
        clean = lease.close(proc, min(deadline, time.monotonic() + 1)) if lease is not None else proc is None
        value['cleanup_attestation'] = ('OWNED_ANCESTRY_REAPED' if proc is not None else 'NOT_STARTED') if clean else 'NOT_ATTESTED'
        if not clean:
            value['status'] = 'CLEANUP_UNCONFIRMED'
        value.update(elapsed_ms=max(0, int((time.monotonic() - started) * 1000)),
            stdout_captured_bytes=len(streams['out']), stderr_captured_bytes=len(streams['err']),
            stdout_eof=eof['out'], stderr_eof=eof['err'],
            failure_signal=failure_signal(bytes(streams['err']), eof['err']))
    return value

def comparison(value):
    a, b = value['measurements']
    if not value['identity_stable'] or not value['within_budget']:
        return 'NOT_PROVEN'
    if any(r['cleanup_attestation'] != 'OWNED_ANCESTRY_REAPED' or not r['stdout_eof'] or
           not r['stderr_eof'] or r['status'] not in {'SUCCESS', 'NONZERO'} for r in (a, b)):
        return 'NOT_PROVEN'
    if a['status'] != 'SUCCESS':
        return 'NOT_COMPARABLE'
    if b['status'] == 'SUCCESS':
        return 'STARTUP_FAILURE_NOT_REPRODUCED'
    if b['exit_code'] is not None and b['exit_code'] > 0 and b['failure_signal'] == 'GO_PAGE_SUMMARY_RESERVATION_FAILED':
        return 'CURRENT_STARTUP_AS_FAILURE_REPRODUCED'
    return 'NOT_PROVEN'

def collect():
    started = time.monotonic()
    deadline = started + OUTER_SECONDS
    value = {'schema': SCHEMA, 'status': 'NOT_RUN', 'reason': 'UNAVAILABLE', 'elapsed_ms': 0,
        'measurements': [empty_row(p) for p in PROFILES], 'binary_fingerprint_sha256': None,
        'binary_bytes': None, 'identity_stable': False, 'within_budget': True,
        'inherited_as_soft_bytes': None, 'inherited_as_hard_bytes': None, 'limits_comparable': False,
        'comparison': 'NOT_PROVEN', 'root_cause': 'NOT_ESTABLISHED', 'original19': 'NOT_ATTESTED',
        'production_mutation': False, 'deployment_authorized': False}
    try:
        require(os.geteuid() == 0)
        before = trusted_identity()
        value['binary_fingerprint_sha256'] = hashlib.sha256(json.dumps(before[-1], separators=(',', ':')).encode()).hexdigest()
        value['binary_bytes'] = before[-1][5]
        soft, hard = resource.getrlimit(resource.RLIMIT_AS)
        value['inherited_as_soft_bytes'] = None if soft == resource.RLIM_INFINITY else soft
        value['inherited_as_hard_bytes'] = None if hard == resource.RLIM_INFINITY else hard
        value['limits_comparable'] = (soft == resource.RLIM_INFINITY or soft > AS_BYTES) and (hard == resource.RLIM_INFINITY or hard >= AS_BYTES)
        if not value['limits_comparable']:
            value.update(reason='INHERITED_AS_NOT_COMPARABLE', comparison='NOT_COMPARABLE')
            return validate_report(value)
        value['measurements'][0] = run_profile(PROFILES[0], deadline, False)
        require(trusted_identity() == before)
        if (value['measurements'][0]['status'] == 'SUCCESS' and
                value['measurements'][0]['cleanup_attestation'] == 'OWNED_ANCESTRY_REAPED' and
                time.monotonic() + 2 < deadline):
            value['measurements'][1] = run_profile(PROFILES[1], deadline, True)
        value['identity_stable'] = trusted_identity() == before
        value['reason'] = 'MEASURED' if value['identity_stable'] else 'IDENTITY_CHANGED'
    except (OSError, ValueError, subprocess.SubprocessError):
        value['reason'] = 'UNAVAILABLE_OR_IDENTITY_CHANGED'
    finally:
        value['elapsed_ms'] = max(0, int((time.monotonic() - started) * 1000))
        value['within_budget'] = time.monotonic() <= deadline
    value['comparison'] = comparison(value)
    value['status'] = 'SUCCESS' if value['comparison'] in {'CURRENT_STARTUP_AS_FAILURE_REPRODUCED', 'STARTUP_FAILURE_NOT_REPRODUCED'} else 'UNKNOWN'
    return validate_report(value)

def validate_report(value):
    keys = {'schema','status','reason','elapsed_ms','measurements','binary_fingerprint_sha256','binary_bytes',
        'identity_stable','within_budget','inherited_as_soft_bytes','inherited_as_hard_bytes','limits_comparable',
        'comparison','root_cause','original19','production_mutation','deployment_authorized'}
    require(type(value) is dict and set(value) == keys and value['schema'] == SCHEMA)
    require(value['status'] in {'SUCCESS','UNKNOWN','NOT_RUN'} and value['reason'] in
        {'UNAVAILABLE','INHERITED_AS_NOT_COMPARABLE','MEASURED','IDENTITY_CHANGED','UNAVAILABLE_OR_IDENTITY_CHANGED'})
    require(value['root_cause'] == 'NOT_ESTABLISHED' and value['original19'] == 'NOT_ATTESTED' and
            value['production_mutation'] is False and value['deployment_authorized'] is False)
    for k in ('identity_stable','within_budget','limits_comparable'):
        require(type(value[k]) is bool)
    for k in ('elapsed_ms','binary_bytes','inherited_as_soft_bytes','inherited_as_hard_bytes'):
        require(value[k] is None and k != 'elapsed_ms' or type(value[k]) is int and 0 <= value[k] < 2**63)
    require(value['binary_fingerprint_sha256'] is None or type(value['binary_fingerprint_sha256']) is str and re.fullmatch('[0-9a-f]{64}',value['binary_fingerprint_sha256']))
    require((value['binary_fingerprint_sha256'] is None) == (value['binary_bytes'] is None))
    if value['limits_comparable']:
        require((value['inherited_as_soft_bytes'] is None or value['inherited_as_soft_bytes'] > AS_BYTES) and
                (value['inherited_as_hard_bytes'] is None or value['inherited_as_hard_bytes'] >= AS_BYTES))
    if value['within_budget']:
        require(value['elapsed_ms'] <= OUTER_SECONDS * 1000)
    require(type(value['measurements']) is list and len(value['measurements']) == 2)
    for profile, row in zip(PROFILES,value['measurements']):
        require(type(row) is dict and set(row) == set(empty_row(profile)) and row['profile'] == profile and row['status'] in ROW_STATES)
        require(type(row['elapsed_ms']) is int and 0 <= row['elapsed_ms'] < 2**63)
        for k in ('stdout_captured_bytes','stderr_captured_bytes'):
            require(type(row[k]) is int and 0 <= row[k] <= MAX_STREAM + 1)
        for k in ('stdout_eof','stderr_eof'):
            require(type(row[k]) is bool)
        require(row['cleanup_attestation'] in CLEANUP and row['failure_signal'] in SIGNALS)
        require((row['status'] == 'CLEANUP_UNCONFIRMED') == (row['cleanup_attestation'] == 'NOT_ATTESTED'))
        code, sig = row['exit_code'], row['signal']
        require(code is None or type(code) is int and 0 <= code <= 255)
        require(sig is None or type(sig) is int and 1 <= sig <= 64)
        require(code is None or sig is None)
        if row['status'] in {'SUCCESS','NONZERO'}:
            require(row['cleanup_attestation'] == 'OWNED_ANCESTRY_REAPED' and row['stdout_eof'] and row['stderr_eof'])
            require((row['status'] == 'SUCCESS') == (code == 0) and (code is not None or sig is not None))
        if row['status'] == 'NOT_RUN':
            require(row == empty_row(profile))
        if row['failure_signal'] == 'GO_PAGE_SUMMARY_RESERVATION_FAILED':
            require(row['stderr_eof'] and 0 < row['stderr_captured_bytes'] <= MAX_STREAM)
    expected = 'NOT_COMPARABLE' if value['reason'] == 'INHERITED_AS_NOT_COMPARABLE' else comparison(value)
    require(value['comparison'] == expected)
    require((value['status'] == 'SUCCESS') == (expected in {'CURRENT_STARTUP_AS_FAILURE_REPRODUCED','STARTUP_FAILURE_NOT_REPRODUCED'}))
    if value['status'] == 'SUCCESS':
        require(value['reason'] == 'MEASURED' and value['limits_comparable'] and value['binary_fingerprint_sha256'] is not None and
                value['binary_bytes'] > 0 and value['elapsed_ms'] >= sum(r['elapsed_ms'] for r in value['measurements']))
    require(len(json.dumps(value, separators=(',', ':')).encode()) <= 3072)
    return value

if __name__ == '__main__':
    try:
        report = validate_report(collect())
        print(json.dumps(report, sort_keys=True, separators=(',', ':')))
        raise SystemExit(0 if report['status'] == 'SUCCESS' else 1)
    except Exception:
        raise SystemExit(1) from None
