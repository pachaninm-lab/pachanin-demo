#!/usr/bin/env python3
"""Fault injection for the full release/rollback sequence; no production adapter execution."""
import contextlib
import copy
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

PATH = Path(__file__).with_name('api-only-release-controller.py')
spec = importlib.util.spec_from_file_location('controller', PATH)
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)


def intent():
    value = {
        'schema': c.SCHEMA, 'target_sha': 'a' * 40, 'baseline_sha': 'b' * 40,
        'baseline_image_id': 'sha256:' + 'c' * 64,
        'api_digest': 'ghcr.io/pachaninm-lab/grainflow-api@sha256:' + 'd' * 64,
        'operation_id': '123', 'run_id': '456', 'not_before': 900, 'expires': 1100,
        'policy_source_sha': 'a' * 40, 'image_unpacked_bytes': 1024,'public_ipv4':'195.19.12.120',
        'source_parity': {'schema': 'pc.api-schema-source-parity.v1', 'result': 'SOURCE_PARITY_ONLY',
                          'source_parity': 'IDENTICAL', 'baseline_sha': 'b' * 40, 'target_sha': 'a' * 40,
                          'deployment_authorized': False, 'checkout_worktree': 'NOT_ATTESTED',
                          'schema_manifest_sha256': 'e' * 64},
        'migrations': {'0001_postgresql_initial': 'f' * 64},
        'catalog_sha256': '1' * 64, 'principal_sha256': {'default': '2' * 64, 'registration': '3' * 64},
        'original_volumes': [f'vol-{i:02}' for i in range(19)],
        'finite_grant': {'owner': 'pachaninm-lab', 'target_sha': 'a' * 40,
                         'operation_id': '123', 'claim_id': '789', 'source_accepted': True,
                         'native_accepted': True, 'legacy_operations_fenced': True},
    }
    value['baseline_publication']={'schema':'pc.api-only-baseline-publication.v1',
        'api_digest':'ghcr.io/pachaninm-lab/grainflow-api@sha256:'+'a'*64,
        'image_id':value['baseline_image_id'],'revision':value['baseline_sha'],
        'source':'https://github.com/pachaninm-lab/pachanin-demo','verification':'CANONICAL_DIGEST_CONFIG_MATCH'}
    value['oracle']={'schema':'pc.api-only-target-oracle.v1','status':'VERIFIED',
                     'target_sha':value['target_sha'],'api_digest':value['api_digest'],
                     'migration_digest':'ghcr.io/pachaninm-lab/grainflow-migration@sha256:'+'0'*64,
                     'producer_run_id':value['run_id'],'query_sha256':c.query_sha256(),
                     'catalog_sha256':value['catalog_sha256'],'principal_sha256':copy.deepcopy(value['principal_sha256']),
                     'migrations':copy.deepcopy(value['migrations']),'isolated_cleanup':'VERIFIED',
                     'negative_cases':{'wrong_database':'PASS','principal_bypass':'PASS','policy_drift':'PASS','function_grant_drift':'PASS'}}
    return value


class FakeHost:
    """Stateful engine model; mutation order, image identity and override recovery matter."""
    def __init__(self, fail=None, original=None):
        self.events, self.fail, self.locked, self.spent = [], fail, False, False
        self.baseline = {'api_id': '4' * 64, 'image_id': 'sha256:' + 'c' * 64,
                         'revision': 'b' * 40, 'ready': True, 'runtime_fingerprint': '5' * 64,
                         'siblings': '6' * 64, 'volumes': '7' * 64, 'preservation': '8' * 64,
                         'override': original}
        self.state = copy.deepcopy(self.baseline)
        self.override = original
        self.new_id = 'sha256:' + '9' * 64
        self.recreates = 0
        self.db_calls = 0
        self.fails = set()

    def event(self, key, *, mutation=False):
        self.events.append((key, self.locked))
        if mutation and not self.locked:
            raise AssertionError('mutation outside lease')
        if key == self.fail and key not in self.fails:
            self.fails.add(key)
            raise c.ReleaseError('INJECTED_FAILURE')

    def now(self): return 1000

    def admitted_reference(self, value):
        self.event('reference')
        if self.fail == 'unadmitted':
            raise c.ReleaseError('SOURCE_REFERENCE_NOT_ADMITTED')

    @contextlib.contextmanager
    def lock(self):
        self.event('lock')
        if self.fail == 'busy':
            raise c.ReleaseError('LOCK_BUSY')
        self.locked = True
        try: yield
        finally:
            self.events.append(('unlock', self.locked))
            self.locked = False

    def snapshot(self, value, rollback=False):
        self.event('snapshot')
        return copy.deepcopy(self.state)

    def assert_baseline_publication(self,value,baseline):
        self.event('baseline_publication')

    def effective_api_image_id(self):
        self.event('effective')
        if self.fail == 'original_ref_drift' and self.recreates > 1:
            return 'sha256:' + '0' * 64
        return self.state['image_id']

    def assert_current(self, value, baseline):
        self.event('current')
        if self.state != baseline:
            raise c.ReleaseError('BASELINE_CHANGED')

    def capacity(self, value): self.event('capacity')

    def public_smoke(self,value):
        phase='baseline' if self.recreates==0 else 'target' if self.state['revision']=='a'*40 else 'rollback'
        self.event('public:'+phase)
        if self.fail=='public_rollback' and phase in ('target','rollback'):
            raise c.ReleaseError('CANONICAL_PUBLIC_ROOT_NOT_PROVEN')
        if not self.locked:raise AssertionError('public smoke outside lease')

    def database(self, value, state):
        self.db_calls += 1
        self.event('database')
        result = {'database_compatibility': 'VERIFIED_TARGET_CONTRACT', 'catalog_match': True,
                  'principals_match': True, 'migration_match': True, 'both_clients_bound': True}
        if self.fail == 'db_unproved' or self.fail == 'target_db' and state['revision']=='a'*40:
            result['database_compatibility'] = 'NOT_PROVEN'
        return result

    def journal_begin(self, value, baseline):
        self.event('reserve', mutation=True)
        if self.spent:
            raise c.ReleaseError('OPERATION_ALREADY_SPENT_RECONCILE')
        self.spent = True

    def journal_write(self, phase): self.event('journal:' + phase, mutation=True)

    def backup(self, value, baseline):
        self.event('backup', mutation=True)
        return {'classification': 'CRITICAL_STATE_RESTORE_VERIFIED_NOT_RELEASE_ACCEPTANCE',
                'target_sha': value['target_sha'], 'disposable_cleanup': 'VERIFIED',
                'source_mutation': 'NONE', 'deployment_authorized': False}

    def pull(self, image, target):
        self.event('pull', mutation=True)
        if self.fail == 'pull_result_bad': return 'mutable'
        return self.new_id

    def write_override(self, image):
        self.event('write:' + ('baseline' if image == self.baseline['image_id'] else 'target'), mutation=True)
        self.desired = image
        self.override = {'bytes': image.encode(), 'mode': 0o600, 'uid': 0, 'gid': 0}
        self.state['override'] = copy.deepcopy(self.override)

    def recreate_api(self):
        self.recreates += 1
        self.event('recreate:' + str(self.recreates), mutation=True)
        target = self.desired != self.baseline['image_id']
        self.state.update(api_id=str(self.recreates) * 64,
                          image_id=self.new_id if target else self.baseline['image_id'],
                          revision='a' * 40 if target else self.baseline['revision'])
        if self.fail in ('sibling_drift', 'volume_drift', 'preservation_drift') and target:
            field = {'sibling_drift': 'siblings', 'volume_drift': 'volumes', 'preservation_drift': 'preservation'}[self.fail]
            self.state[field] = 'changed'
        if self.fail == 'config_drift' and target: self.state['runtime_fingerprint'] = 'changed'
        if self.fail == 'wrong_image' and target: self.state['image_id'] = 'sha256:' + '0' * 64

    def wait_api(self):
        self.event('wait:' + str(self.recreates))
        if self.fail == 'wait_failure' and self.recreates == 1:
            raise c.ReleaseError('API_READINESS_TIMEOUT')
        return copy.deepcopy(self.state)

    def restore_override(self, record):
        self.event('restore_override', mutation=True)
        self.override = copy.deepcopy(record)
        self.state['override'] = copy.deepcopy(record)

    def close(self): self.event('close')


class ControllerTests(unittest.TestCase):
    def test_real_complete_sequence_requires_actual_runtime_and_second_database_check(self):
        host = FakeHost()
        report = c.release(intent(), host)
        self.assertEqual(report['result'], 'API_IMAGE_RELEASE_VERIFIED')
        self.assertTrue(report['api_image_updated'])
        self.assertEqual(host.db_calls, 2)
        names = [x[0] for x in host.events]
        self.assertLess(names.index('capacity'), names.index('reserve'))
        self.assertLess(names.index('reserve'), names.index('backup'))
        self.assertLess(names.index('backup'), names.index('pull'))
        self.assertLess(names.index('pull'), names.index('write:target'))
        self.assertLess(names.index('public:target'), names.index('journal:API_IMAGE_VERIFIED'))
        self.assertLess(names.index('journal:API_IMAGE_VERIFIED'), names.index('unlock'))
        for name, held in host.events:
            if name in ('backup', 'pull') or name.startswith(('write:', 'recreate:', 'journal:')):
                self.assertTrue(held, name)
        for flag in ('registration_accepted', 'bank_accepted', 'fgis_accepted', 'full_dr_accepted', 'deployment_authorized'):
            self.assertIs(report[flag], False)

    def test_readonly_preflight_never_reserves_pulls_backs_up_or_writes(self):
        host = FakeHost()
        result = c.release(intent(), host, preflight=True)
        self.assertEqual(result['result'], 'PREFLIGHT_ONLY')
        names = [v[0] for v in host.events]
        self.assertFalse(any(v in names for v in ('reserve', 'backup', 'pull', 'write:target')))

    def test_missing_admission_stops_before_lock_or_any_host_observation(self):
        host = FakeHost('unadmitted')
        report = c.release(intent(), host)
        self.assertEqual(report['reason'], 'SOURCE_REFERENCE_NOT_ADMITTED')
        self.assertEqual(host.events, [('reference', False), ('close', False)])

    def test_oracle_is_exact_workflow_run_source_digest_and_query_bound(self):
        value=intent()
        for key,replacement in [('api_digest','wrong'),('target_sha','b'*40),
                                ('producer_run_id','999'),('query_sha256','0'*64)]:
            wrong=copy.deepcopy(value);wrong['oracle'][key]=replacement
            with self.subTest(key=key),self.assertRaises(c.ReleaseError):
                c.validate_intent(wrong,1000)

    def test_real_production_adapter_denies_without_network_or_docker(self):
        host = object.__new__(c.Host)
        host.identity_token = 'malformed'
        host.now = lambda: 1000
        with self.assertRaisesRegex(c.ReleaseError, 'OIDC_TOKEN_REQUIRED'):
            host.admitted_reference(intent())

    def test_all_recovery_steps_keep_lease_and_restore_absence(self):
        host = FakeHost('wait_failure')
        report = c.release(intent(), host)
        self.assertEqual(report['result'], 'ROLLED_BACK_API_IMAGE_ONLY')
        self.assertEqual(report['rollback'], 'VERIFIED')
        self.assertEqual(host.state['image_id'], host.baseline['image_id'])
        self.assertIsNone(host.state['override'])
        for name, held in host.events:
            if name.startswith(('write:', 'recreate:', 'wait:', 'restore_override')):
                self.assertTrue(held, name)
        names = [x[0] for x in host.events]
        self.assertLess(names.index('restore_override'), names.index('unlock'))

    def test_original_override_bytes_mode_owner_and_group_recover_exactly(self):
        original = {'bytes': b'# preserve exact bytes\nservices: {}\n', 'mode': 0o640, 'uid': 0, 'gid': 123}
        host = FakeHost('wait_failure', original)
        self.assertEqual(c.release(intent(), host)['rollback'], 'VERIFIED')
        self.assertEqual(host.state['override'], original)

    def test_mutable_original_reference_drift_never_claims_rollback_verified(self):
        host = FakeHost('original_ref_drift')
        host.fails.add('wait:1')
        base_wait = host.wait_api
        def wait():
            if host.recreates == 1: raise c.ReleaseError('FORCED_FAILURE')
            return base_wait()
        host.wait_api = wait
        report = c.release(intent(), host)
        self.assertEqual(report['result'], 'RECONCILIATION_REQUIRED')
        self.assertEqual(report['rollback'], 'NOT_PROVEN')

    def test_injected_partial_recreate_failure_still_rolls_back(self):
        host = FakeHost('recreate:1')
        result = c.release(intent(), host)
        self.assertEqual(result['rollback'], 'VERIFIED')
        self.assertEqual(host.recreates, 3)

    def test_signal_like_exception_is_caught_and_rollback_attempted(self):
        host = FakeHost()
        base_wait = host.wait_api
        def wait():
            if host.recreates == 1: raise KeyboardInterrupt()
            return base_wait()
        host.wait_api = wait
        self.assertEqual(c.release(intent(), host)['rollback'], 'VERIFIED')

    def test_journal_reservation_is_not_replayed_after_pre_mutation_failure(self):
        host = FakeHost('backup')
        first = c.release(intent(), host)
        self.assertEqual(first['rollback'], 'NOT_ATTEMPTED')
        self.assertTrue(host.spent)
        second = c.release(intent(), host)
        self.assertEqual(second['reason'], 'OPERATION_ALREADY_SPENT_RECONCILE')
        self.assertEqual([x[0] for x in host.events].count('backup'), 1)

    def test_target_db_binding_failure_rolls_back_without_claiming_business_restore(self):
        host = FakeHost('target_db')
        report = c.release(intent(), host)
        self.assertEqual(report['rollback'], 'VERIFIED')
        self.assertEqual(report['business_data_rollback'], 'NOT_PERFORMED')

    def test_before_api_gates_never_recreate(self):
        for failure in ('capacity', 'public:baseline', 'db_unproved', 'reserve', 'backup', 'pull', 'pull_result_bad', 'busy'):
            with self.subTest(failure=failure):
                host = FakeHost(failure)
                result = c.release(intent(), host)
                self.assertEqual(result['result'], 'HOLD')
                self.assertEqual(result['rollback'], 'NOT_ATTEMPTED')
                self.assertEqual(host.recreates, 0)

    def test_protected_sibling_volume_preservation_and_config_drift_cannot_pass(self):
        for failure in ('sibling_drift', 'volume_drift', 'preservation_drift', 'config_drift'):
            with self.subTest(failure=failure):
                result = c.release(intent(), FakeHost(failure))
                self.assertEqual(result['result'], 'RECONCILIATION_REQUIRED')
                self.assertEqual(result['rollback'], 'NOT_PROVEN')

    def test_wrong_target_image_triggers_immutable_baseline_rollback(self):
        self.assertEqual(c.release(intent(), FakeHost('wrong_image'))['rollback'], 'VERIFIED')

    def test_rollback_failure_is_distinct_from_verified_recovery(self):
        host = FakeHost('write:baseline')
        old_wait = host.wait_api
        def wait():
            if host.recreates == 1: raise c.ReleaseError('API_TIMEOUT')
            return old_wait()
        host.wait_api = wait
        result = c.release(intent(), host)
        self.assertEqual(result['result'], 'RECONCILIATION_REQUIRED')
        self.assertEqual(result['rollback'], 'NOT_PROVEN')

    def test_rollback_still_attempts_when_journal_update_fails(self):
        host = FakeHost('journal:ROLLBACK_ARMED')
        old_wait = host.wait_api
        def wait():
            if host.recreates == 1: raise c.ReleaseError('API_TIMEOUT')
            return old_wait()
        host.wait_api = wait
        self.assertEqual(c.release(intent(), host)['rollback'], 'VERIFIED')

    def test_invalid_input_is_redacted_and_cannot_access_host(self):
        value = intent()
        value['target_sha'] = 'postgres://sensitive-canary'
        host = FakeHost()
        result = c.release(value, host)
        self.assertNotIn('sensitive-canary', json.dumps(result))
        self.assertIsNone(result['target_sha'])
        self.assertEqual(host.events, [('close', False)])

    def test_duplicate_json_and_constants_fail_closed(self):
        for raw in (b'{"x":1,"x":2}', b'{"x":NaN}', b'{"x":Infinity}', b'\xff'):
            with self.subTest(raw=raw), self.assertRaises(c.ReleaseError):
                c.closed_json(raw)

    def test_exact_input_manifest_accepts_real_initial_migration_name(self):
        self.assertEqual(c.validate_intent(intent(), 1000)['migrations'], {'0001_postgresql_initial': 'f' * 64})

    def test_input_negative_matrix(self):
        specimens = [
            ('api_digest', 'latest'), ('target_sha', 'a' * 7), ('policy_source_sha', 'b' * 40),
            ('catalog_sha256', None), ('principal_sha256', {}), ('image_unpacked_bytes', True),
            ('image_unpacked_bytes', 2**63), ('original_volumes', ['v'] * 19), ('migrations', {}),
            ('migrations', {'outside\nname': 'f' * 64}), ('run_id', '1;sh'),
            ('expires', 10000), ('expires', 999), ('not_before', True), ('operation_id', '-1'),
            ('source_parity', {'result': 'PASS'}), ('finite_grant', {'owner': 'attacker'}),
        ]
        for key, replacement in specimens:
            with self.subTest(key=key, replacement=replacement):
                value = intent(); value[key] = replacement
                host = FakeHost()
                result = c.release(value, host)
                self.assertEqual(result['result'], 'HOLD')
                self.assertEqual(host.events, [('close', False)])

    def test_database_exact_manifest_catalog_and_principal_contract(self):
        value = intent()
        principal = {'super': False, 'bypass': False, 'create_role': False,
                     'create_db': False, 'replication': False, 'inherit':False,'login':True,'memberships':[], 'row_security':'on','same_session_user':True,'session_super':False,'session_bypass':False,
                     'initial_settings':{'row_security':'on','default_transaction_read_only':'off','session_replication_role':'origin'},'role': 'fixture'}
        record = {'ledger': [{'migration_name': '0001_postgresql_initial', 'checksum': 'f' * 64,
                              'finished': True, 'rolled_back': False, 'steps': 0}],
                  'catalog': {'fixture': 'target'}, 'principal': principal}
        value['catalog_sha256'] = c.digest(record['catalog'])
        value['principal_sha256']['registration'] = c.digest(principal)
        record['ledger']=None
        c.compare_database(record, value, 'registration')
        record['ledger']=[{'migration_name':'0001_postgresql_initial','checksum':'f'*64,'finished':True,'rolled_back':False,'steps':0}]
        value['principal_sha256']['default']=c.digest(principal)
        for modify in (
            lambda r: r['ledger'].append(copy.deepcopy(r['ledger'][0])),
            lambda r: r['ledger'][0].update(checksum='0' * 64),
            lambda r: r['ledger'][0].update(finished=False),
            lambda r: r['ledger'][0].update(rolled_back=True),
            lambda r: r['ledger'][0].update(migration_name='extra'),
            lambda r: r['catalog'].update(drift='hidden'),
            lambda r: r['principal'].update(super=True),
        ):
            wrong = copy.deepcopy(record); modify(wrong)
            with self.assertRaises(c.ReleaseError):
                c.compare_database(wrong, value, 'default')

    def test_database_node_program_is_closed_and_readonly_for_both_actual_constructors(self):
        for client in ('default', 'registration'):
            program = c.database_program(client)
            self.assertIn('SET TRANSACTION READ ONLY', program)
            self.assertIn("idle_in_transaction_session_timeout='10s'", program)
            self.assertNotIn('onModuleInit', program)
            self.assertIn('AuthPrismaService' if client == 'registration' else 'PrismaClient', program)
            result = subprocess.run(['node', '--check', '-'], input=program.encode(), capture_output=True)
            self.assertEqual(result.returncode, 0, result.stderr)

    def test_catalog_scope_includes_identity_and_auction_user_schemas(self):
        self.assertNotIn("n.nspname='public'", c.CATALOG_SQL)
        self.assertIn("n.nspname NOT IN ('pg_catalog','information_schema')", c.CATALOG_SQL)

    def test_bounded_runner_real_failure_timeout_output_and_fixed_stderr(self):
        with self.assertRaisesRegex(c.ReleaseError, 'COMMAND_FAILED'):
            c.bounded(['/usr/bin/python3', '-c', "import sys;sys.stderr.write('private-canary');sys.exit(1)"])
        with self.assertRaisesRegex(c.ReleaseError, 'COMMAND_TIMEOUT'):
            c.bounded(['/usr/bin/python3', '-c', 'import time;time.sleep(3)'], timeout=0.05)
        with self.assertRaisesRegex(c.ReleaseError, 'COMMAND_OUTPUT_BOUND'):
            c.bounded(['/usr/bin/python3', '-c', "print('x'*10000)"], limit=20)
        self.assertEqual(c.bounded(['/usr/bin/python3', '-c', "print('bounded')"]), b'bounded\n')



    def test_owned_filesystem_atomic_mode_bytes_and_absence_recovery(self):
        import os
        self.assertEqual(os.geteuid(),0,'Native controller filesystem checks require the documented sudo test invocation')
        with tempfile.TemporaryDirectory(prefix='pc-api-unit-',dir='/run') as folder:
            original={'bytes':b'# original bytes\\nservices: {}\\n','uid':0,'gid':os.getegid(),'mode':0o640}
            c.atomic_file(folder,c.OVERRIDE,original)
            self.assertEqual(c.file_read(folder+'/'+c.OVERRIDE),original)
            c.atomic_file(folder,c.OVERRIDE,{'bytes':b'changed\\n','uid':0,'gid':0,'mode':0o600})
            host=object.__new__(c.Host);host.working=folder
            host.restore_override(original)
            self.assertEqual(c.file_read(folder+'/'+c.OVERRIDE),original)
            host.restore_override(None)
            self.assertFalse(Path(folder,c.OVERRIDE).exists())

    def test_protected_file_rejects_symlink_hardlink_and_shared_parent(self):
        import os
        self.assertEqual(os.geteuid(),0)
        with tempfile.TemporaryDirectory(prefix='pc-api-unit-',dir='/run') as folder:
            target=Path(folder,'target');target.write_bytes(b'private');target.chmod(0o600)
            link=Path(folder,'link');link.symlink_to(target)
            with self.assertRaises(OSError):
                c.file_read(str(link))
            linked=Path(folder,'hardlink');os.link(target,linked)
            with self.assertRaisesRegex(c.ReleaseError,'PROTECTED_FILE_PROFILE'):
                c.file_read(str(linked))
            with self.assertRaisesRegex(c.ReleaseError,'OUTPUT_TARGET_PROFILE'):
                c.atomic_file(folder,'link',{'bytes':b'x','uid':0,'gid':0,'mode':0o600})
            Path(folder).chmod(0o777)
            with self.assertRaisesRegex(c.ReleaseError,'DIRECTORY_OWNER_MODE'):
                c.file_read(str(target))

    def test_preservation_hash_streams_and_rejects_wrong_ciphertext(self):
        import hashlib,os
        self.assertEqual(os.geteuid(),0)
        with tempfile.TemporaryDirectory(prefix='pc-api-unit-',dir='/run') as folder:
            path=Path(folder,'cipher');raw=b'pinned'*1024*1024;path.write_bytes(raw);path.chmod(0o600)
            c.protected_sha256(str(path),hashlib.sha256(raw).hexdigest())
            with self.assertRaisesRegex(c.ReleaseError,'PRESERVED_CIPHERTEXT_CHANGED'):
                c.protected_sha256(str(path),'0'*64)

    def test_hostname_normalization_preserves_explicit_policy(self):
        def row(cid,hostname):
            return {'Id':cid,'Config':{'Hostname':hostname,'Labels':{'com.docker.compose.project.config_files':'changed-intentionally'}},
                    'HostConfig':{},'NetworkSettings':{'Networks':{'project_default':{}}},'Mounts':[]}
        old=row('a'*64,'a'*12);new=row('b'*64,'b'*12)
        self.assertEqual(c.runtime_fingerprint(old),c.runtime_fingerprint(new))
        old['Config']['Hostname']='explicit-host'
        new['Config']['Hostname']='changed-explicit-host'
        self.assertNotEqual(c.runtime_fingerprint(old),c.runtime_fingerprint(new))

    def test_window_requires_one_current_unedited_owner_disposition(self):
        value=intent();claim={**value['finite_grant'],'not_before':900,'expires':1100,
                             'original_volume_inventory_sha256':c.digest(value['original_volumes'])}
        del claim['claim_id']
        row={'id':789,'user':{'login':'pachaninm-lab'},'author_association':'OWNER',
             'created_at':'same','updated_at':'same','body':'PC_API_ONLY_HOST_WINDOW\n'+json.dumps(claim)}
        self.assertEqual(c.bind_window([row],'a'*40,'123',1000)['claim_id'],'789')
        for wrong in ([row,row],[{**row,'updated_at':'changed'}],[{**row,'author_association':'MEMBER'}],[]):
            with self.assertRaises(c.ReleaseError):
                c.bind_window(wrong,'a'*40,'123',1000)
        with self.assertRaises(c.ReleaseError):
            c.bind_window([row],'a'*40,'123',1200)



    def test_public_failure_rolls_back_before_lock_exit_and_requires_restored_public_success(self):
        host=FakeHost('public:target')
        result=c.release(intent(),host)
        self.assertEqual(result['rollback'],'VERIFIED')
        self.assertEqual(result['runtime_state'],'BASELINE_IMAGE_VERIFIED')
        names=[n for n,_ in host.events]
        self.assertNotIn('journal:API_IMAGE_VERIFIED',names)
        self.assertLess(names.index('public:rollback'),names.index('journal:ROLLED_BACK_API_IMAGE_ONLY'))
        self.assertLess(names.index('journal:ROLLED_BACK_API_IMAGE_ONLY'),names.index('unlock'))
        for name,held in host.events:
            if name.startswith('public:'):self.assertTrue(held,name)

    def test_public_recovery_failure_is_unknown_not_verified(self):
        result=c.release(intent(),FakeHost('public_rollback'))
        self.assertEqual(result['result'],'RECONCILIATION_REQUIRED')
        self.assertEqual(result['runtime_state'],'UNKNOWN_RECONCILIATION_REQUIRED')
        self.assertEqual(result['rollback'],'NOT_PROVEN')
        self.assertFalse(result['api_image_updated'])

    def test_public_child_is_fixed_readonly_and_bounded_by_owned_process(self):
        self.assertNotIn('POST',c.PUBLIC_SMOKE_PROGRAM)
        self.assertIn("socket.getaddrinfo(domain,443",c.PUBLIC_SMOKE_PROGRAM)
        self.assertIn("response.status!=200",c.PUBLIC_SMOKE_PROGRAM)
        self.assertIn("NoRedirect",c.PUBLIC_SMOKE_PROGRAM)
        compile(c.PUBLIC_SMOKE_PROGRAM,'<public-smoke>','exec')


    def test_literal_compose_profile_captures_inputs_and_rejects_hidden_transitive_forms(self):
        raw=b'services:\n  api:\n    image: ghcr.io/example:${IMAGE_TAG:-main}\n    env_file:\n      - .env\n      - "/protected/app.env"\n    environment:\n      LABEL: "quoted [scalar] {value}"\n'
        self.assertEqual(c.declared_env_files(raw,'/protected'),['/protected/.env','/protected/app.env'])
        for bad in (
            b'services: {api: {env_file: /tmp/private-canary}}',
            b'x-env: &vars\n  env_file: /tmp/private-canary\nservices:\n  api:\n    <<: *vars\n',
            b'services:\n  api:\n    "env_\\u0066ile": /tmp/private-canary\n',
            b'"\\u0069nclude": /tmp/private-canary\n',
            b'%TAG !e! tag:example.com,2000:\nservices: {}\n',
            b'? env_file\n: /tmp/private-canary\n',
            b'services:\n  api:\n    !reset env_file: /tmp/private-canary\n',
            b'services:\n  api:\n    env_file: ${EXTERNAL_FILE}\n',
        ):
            with self.subTest(raw=bad),self.assertRaises(c.ReleaseError):
                c.declared_env_files(bad,'/protected')

    def test_actual_shell_resolver_requires_canonical_digest_revision_and_budget(self):
        import os,re
        workflow=PATH.parents[2]/'.github/workflows/production-api-only-release.yml'
        body=workflow.read_text().split('\n  images:\n',1)[1].split('\n  oracle:\n',1)[0]
        lines=body.splitlines();start=lines.index('        run: |')+1;script=[]
        for line in lines[start:]:
            if line and not line.startswith('          '):break
            script.append(line[10:] if line else '')
        script='\n'.join(script)
        fake=r"""#!/usr/bin/python3
import json,os,sys
a=sys.argv[1:]
with open(os.environ['DOCKER_LOG'],'a') as out:out.write(json.dumps(a)+'\n')
if a[0]=='login':sys.stdin.read()
elif a[0]=='pull':pass
elif a[:2]==['image','inspect']:
 ref=a[-1];component='migration' if 'migration:' in ref else 'api';fmt=a[a.index('--format')+1]
 if 'revision' in fmt:print('b'*40 if os.environ.get('BAD')=='revision' else os.environ['TARGET_SHA'])
 elif 'RepoDigests' in fmt:
  prefix='docker.io/rogue' if os.environ.get('BAD')=='namespace' else 'ghcr.io/pachaninm-lab/grainflow-'+component
  print(json.dumps([prefix+'@sha256:'+'d'*64]))
 elif '.Size' in fmt:print(2**33 if os.environ.get('BAD')=='budget' else 123456)
 else:sys.exit(1)
else:sys.exit(1)
"""
        with tempfile.TemporaryDirectory() as folder:
            folder=Path(folder);binary=folder/'docker';binary.write_text(fake);binary.chmod(0o755)
            for bad in ('','revision','namespace','budget'):
                output=folder/('output-'+(bad or 'valid'));log=folder/('log-'+(bad or 'valid'))
                env={**os.environ,'PATH':str(folder)+':'+os.environ['PATH'],'GH_TOKEN':'fixture-only',
                     'TARGET_SHA':'a'*40,'GITHUB_ACTOR':'fixture','GITHUB_OUTPUT':str(output),
                     'DOCKER_LOG':str(log),'BAD':bad}
                result=subprocess.run(['/usr/bin/bash','-c',script],env=env,capture_output=True,timeout=5)
                if bad:self.assertNotEqual(result.returncode,0,bad)
                else:
                    self.assertEqual(result.returncode,0,result.stderr)
                    self.assertIn('api_digest=ghcr.io/pachaninm-lab/grainflow-api@sha256:'+'d'*64,output.read_text())
                    self.assertIn('migration_digest=ghcr.io/pachaninm-lab/grainflow-migration@sha256:'+'d'*64,output.read_text())
                    pulls=[json.loads(x) for x in log.read_text().splitlines() if json.loads(x)[0]=='pull']
                    self.assertEqual(pulls,[['pull','ghcr.io/pachaninm-lab/grainflow-api:sha-aaaaaaa'],
                                            ['pull','ghcr.io/pachaninm-lab/grainflow-migration:sha-aaaaaaa']])


    def test_declared_unhealthy_or_starting_docker_policy_cannot_pass_http_readiness(self):
        host=object.__new__(c.Host)
        host.run=lambda *a,**k: b''
        for status in ('starting','unhealthy','healthy'):
            host.inspect=lambda _api,ss=status: {'State':{'Running':True,'Health':{'Status':ss}}}
            self.assertIs(host.ready('a'*64),status=='healthy')
        host.inspect=lambda _api: {'State':{'Running':False}}
        self.assertFalse(host.ready('a'*64))
        self.assertIn("/platform-v7",c.PUBLIC_SMOKE_PROGRAM)
        self.assertNotIn("url='https://'+domain+'/'",c.PUBLIC_SMOKE_PROGRAM)
        self.assertIn("getpeername",c.PUBLIC_SMOKE_PROGRAM)


    def test_actual_fixed_public_program_protocol_rejects_wrong_route_peer_status_and_body(self):
        harness=r"""
import socket,sys,types,urllib.request,urllib.error
scenario,program=sys.argv[1:]
expected='195.19.12.120'
socket.getaddrinfo=lambda *a,**k:[(2,1,6,'',(('203.0.113.1' if scenario=='dns' else expected),443))]
class Response:
 status=503 if scenario=='status' else 200
 headers=types.SimpleNamespace(get_content_type=lambda:'application/json' if scenario=='type' else 'text/html')
 fp=types.SimpleNamespace(raw=types.SimpleNamespace(_sock=types.SimpleNamespace(
     getpeername=lambda:('203.0.113.1' if scenario=='peer' else expected,443))))
 calls=0
 def __enter__(self):return self
 def __exit__(self,*args):pass
 def geturl(self):return 'https://wrong.invalid/' if scenario=='route' else self.url
 def read1(self,n):
  self.calls+=1
  if scenario=='empty':return b''
  if scenario=='oversize':return b'x'*n
  return b'<html>fixture</html>' if self.calls==1 else b''
class Opener:
 def open(self,request,timeout):
  if request.get_method()!='GET' or request.data is not None:raise ValueError('MUTATING_REQUEST')
  if not request.full_url.endswith('/platform-v7'):raise ValueError('WRONG_FIXED_PATH')
  if scenario=='redirect':raise urllib.error.HTTPError(request.full_url,308,'redirect',{},None)
  r=Response();r.url=request.full_url;return r
def builder(handler):
 if handler.redirect_request(None,None,308,None,None,'https://wrong.invalid/') is not None:
  raise ValueError('ARBITRARY_REDIRECT')
 return Opener()
urllib.request.build_opener=builder
sys.argv=['<fixed-program>',expected]
exec(compile(program,'<fixed-public-program>','exec'))
"""
        for scenario in ('valid','dns','peer','status','type','route','empty','oversize','redirect'):
            result=subprocess.run(['/usr/bin/python3','-I','-c',harness,scenario,c.PUBLIC_SMOKE_PROGRAM],
                                  stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=5)
            with self.subTest(scenario=scenario):
                self.assertEqual(result.returncode,0 if scenario=='valid' else 1,result.stderr)
                self.assertEqual(result.stdout,b'CANONICAL_PUBLIC_ROOT=PASS\n' if scenario=='valid' else b'')
                self.assertEqual(result.stderr,b'')


    def test_multifile_env_inputs_use_explicit_project_directory_not_override_parent(self):
        import os
        self.assertEqual(os.geteuid(),0)
        with tempfile.TemporaryDirectory(prefix='pc-api-unit-',dir='/run') as folder:
            base=Path(folder)
            (base/'overrides').mkdir(mode=0o700);(base/'secrets').mkdir(mode=0o700)
            (base/'compose.yml').write_text('services:\n  api:\n    image: fixture\n')
            (base/'overrides/api.yml').write_text('services:\n  api:\n    env_file: secrets/app.env\n')
            (base/'secrets/app.env').write_text('FIXTURE=private\n');(base/'secrets/app.env').chmod(0o600)
            host=object.__new__(c.Host)
            api={'Config':{'Labels':{'com.docker.compose.project':'fixture',
                 'com.docker.compose.project.working_dir':folder,
                 'com.docker.compose.project.config_files':str(base/'compose.yml')+','+str(base/'overrides/api.yml')}}}
            host.configure(api)
            self.assertIn(str(base/'secrets/app.env'),host.inputs)
            self.assertNotIn(str(base/'overrides/secrets/app.env'),host.inputs)


    def test_actual_canonical_hardening_template_and_opaque_block_text(self):
        canonical="""services:
  web:
    container_name: !reset null
    labels: !reset {}
    init: true
    restart: unless-stopped
    environment:
      API_URL: http://api:3001/api
    stop_grace_period: 30s
    healthcheck:
      test:
        - CMD
        - /nodejs/bin/node
        - -e
        - >-
          fetch('http://127.0.0.1:3000/api/health/ready',{signal:AbortSignal.timeout(5000)})
          .then((response)=>response.ok?true:fetch('http://127.0.0.1:3000/platform-v7',{signal:AbortSignal.timeout(5000)}).then((fallback)=>fallback.ok))
          .then((ok)=>{if(!ok)process.exit(1)})
          .catch(()=>process.exit(1))
      interval: 30s
      timeout: 7s
      retries: 3
      start_period: 45s
      start_interval: 5s

  watchtower:
    profiles:
      - retired-watchtower
    restart: "no"
"""
        raw=canonical.encode()
        import hashlib
        self.assertEqual(len(raw),800)
        self.assertEqual(hashlib.sha1(b'blob 800\0'+raw).hexdigest(),'7312f18ebecff054997d2e3828394728ea161f6a')
        c.validate_compose_input_profile(raw)
        api_url=next(line.split('API_URL:',1)[1].strip() for line in canonical.splitlines() if 'API_URL:' in line)
        self.assertTrue(c.canonical_web_api_origin({'NODE_ENV':'production','API_URL':api_url}))
        self.assertFalse(c.canonical_web_api_origin({'NODE_ENV':'production','API_URL':'https://other.invalid/api'}))
        self.assertEqual(c.declared_env_files(raw,'/protected'),[])
        opaque=b'services:\n  api:\n    command: |-\n      env_file: /never/read/this\n      include: /never/read/that\n      x: {not: yaml}\n    env_file: .env\n'
        self.assertEqual(c.declared_env_files(opaque,'/protected'),['/protected/.env'])
        self.assertEqual(raw,canonical.encode())

    def test_actual_gnu_tar_transport_creates_root_owned_private_dependencies(self):
        import io,os,tarfile
        self.assertEqual(os.geteuid(),0)
        with tempfile.TemporaryDirectory(prefix='pc-api-tar-',dir='/run') as folder:
            folder=Path(folder);archive=folder/'source.tgz';stage=folder/'stage';stage.mkdir(mode=0o700)
            with tarfile.open(archive,'w:gz') as tar:
                for name,raw in [('scripts/release/dependency.py',b'fixed-public-source\n'),('registry/config.json',b'{}\n')]:
                    info=tarfile.TarInfo(name);info.size=len(raw);info.uid=1001;info.gid=1001;info.mode=0o666
                    tar.addfile(info,io.BytesIO(raw))
            result=subprocess.run(['/usr/bin/tar','--no-same-owner','--no-same-permissions',
                                   '-xzf',str(archive),'-C',str(stage)],capture_output=True,umask=0o077)
            self.assertEqual(result.returncode,0,result.stderr)
            record=c.file_read(str(stage/'scripts/release/dependency.py'))
            self.assertEqual(record,{'bytes':b'fixed-public-source\n','mode':0o600,'uid':0,'gid':os.getegid()})
            self.assertEqual((stage/'registry/config.json').stat().st_uid,0)


    def test_baseline_publication_uses_observed_digest_not_old_mutable_sha_tag(self):
        value=intent();reference=value['baseline_publication']['api_digest']
        observed={'image_id':value['baseline_image_id'],'revision':value['baseline_sha'],
                  'registry_digests':[reference],'image_ref':'ghcr.io/pachaninm-lab/grainflow-api:sha-oldtag'}
        calls=[]
        def run(args,**kwargs):
            calls.append(args)
            if 'pull' in args:return b''
            return json.dumps([{'Id':observed['image_id'],'RepoDigests':[reference],'Config':{'Labels':{
              'org.opencontainers.image.revision':observed['revision'],
              'org.opencontainers.image.source':'https://github.com/pachaninm-lab/pachanin-demo'}}}]).encode()
        proof=c.acquire_baseline_publication(observed,execute=run)
        self.assertEqual(proof,value['baseline_publication'])
        self.assertEqual(calls[0][-2:],['pull',reference])
        self.assertNotIn('sha-oldtag',json.dumps(calls))
        c.validate_baseline_publication(proof,value)
        for refs in (None,[],['ghcr.io/other/api@sha256:'+'a'*64],[reference,reference]):
            wrong={**observed,'registry_digests':refs}
            with self.subTest(refs=refs),self.assertRaises(c.ReleaseError):
                c.acquire_baseline_publication(wrong,execute=run)
        def mismatch(args,**kwargs):
            if 'pull' in args:return b''
            return json.dumps([{'Id':'sha256:'+'0'*64,'RepoDigests':[reference],
                               'Config':{'Labels':{'org.opencontainers.image.revision':observed['revision'],
                                'org.opencontainers.image.source':'https://github.com/pachaninm-lab/pachanin-demo'}}}]).encode()
        with self.assertRaisesRegex(c.ReleaseError,'BASELINE_PUBLISHED_IMAGE_MISMATCH'):
            c.acquire_baseline_publication(observed,execute=mismatch)

    def test_real_cli_malformed_secret_input_is_never_echoed(self):
        envelope={'intent':{'target_sha':'postgres://private-sentinel'},'identity_token':'jwt-private-sentinel'}
        result=subprocess.run(['/usr/bin/python3','-B',str(PATH),'deploy'],input=json.dumps(envelope).encode(),
                              stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=5)
        self.assertEqual(result.returncode,1)
        self.assertNotIn(b'private-sentinel',result.stdout+result.stderr)
        self.assertEqual(json.loads(result.stdout)['result'],'HOLD')

    def test_trigger_withdrawal_edit_wrong_issue_and_wrong_owner_fail(self):
        row={'id':123,'user':{'login':'pachaninm-lab','id':263435807},'author_association':'OWNER',
             'body':'/production api-only-release current-main','created_at':'same','updated_at':'same',
             'issue_url':'https://api.github.com/repos/pachaninm-lab/pachanin-demo/issues/4637'}
        c.validate_trigger(row,'123')
        for field,bad in [('body','withdrawn'),('updated_at','edited'),('issue_url','other'),('id',999)]:
            wrong={**row,field:bad}
            with self.subTest(field=field),self.assertRaises(c.ReleaseError):
                c.validate_trigger(wrong,'123')

    def test_unauthenticated_oracle_and_native_refs_cannot_reach_host(self):
        for replacement in ({},None):
            value=intent();value['oracle']=replacement
            host=FakeHost()
            self.assertEqual(c.release(value,host)['result'],'HOLD')
            self.assertEqual(host.events,[('close',False)])
        value=intent();value['oracle']['schema']='pc.api-only-native-oracle.v1'
        with self.assertRaises(c.ReleaseError):c.validate_intent(value,1000)

    def test_workflow_embedded_shells_parse_and_exact_oracle_dataflow(self):
        import re
        workflow=PATH.parents[2]/'.github/workflows/production-api-only-release.yml'
        text=workflow.read_text()
        jobs=text.split('jobs:\n',1)[1]
        self.assertEqual(set(re.findall(r'^  ([a-z_]+):$',jobs,re.M)),
                         {'contract','source','build','images','oracle','production','native_oracle'})
        self.assertIn('uses: ./.github/workflows/docker-publish.yml',text)
        self.assertIn('services: api migration',text)
        self.assertIn('needs.oracle.outputs.reference_b64',text)
        self.assertIn('ACTIONS_ID_TOKEN_REQUEST_TOKEN',text)
        self.assertNotIn('StrictHostKeyChecking=no',text)
        self.assertNotIn('/role-eligibility api deploy current-main',text)
        rows=text.splitlines()
        runs=[]
        for i,line in enumerate(rows):
            if line=='        run: |':
                body=[]
                for after in rows[i+1:]:
                    if after and not after.startswith('          '):
                        break
                    body.append(after[10:] if after else '')
                runs.append('\n'.join(body))
        self.assertGreater(len(runs),5)
        for body in runs:
            result=subprocess.run(['/usr/bin/bash','-n'],input=body.encode(),capture_output=True)
            self.assertEqual(result.returncode,0,result.stderr)

    def test_bounded_stdin_nonreader_cannot_escape_global_timeout(self):
        import time
        before=time.monotonic()
        with self.assertRaisesRegex(c.ReleaseError,'COMMAND_TIMEOUT'):
            c.bounded(['/usr/bin/python3','-c','import time;time.sleep(3)'],
                      data=b'x'*(1024*1024),timeout=0.1)
        self.assertLess(time.monotonic()-before,2)

    def test_real_ephemeral_rs256_signature_and_exact_claim_negatives(self):
        import base64
        encode=lambda v: base64.urlsafe_b64encode(v).decode().rstrip('=')
        with tempfile.TemporaryDirectory() as d:
            key=Path(d)/'ephemeral.pem'
            subprocess.run(['/usr/bin/openssl','genpkey','-algorithm','RSA','-pkeyopt',
                            'rsa_keygen_bits:2048','-out',str(key)],check=True,capture_output=True)
            raw=subprocess.check_output(['/usr/bin/openssl','rsa','-in',str(key),'-noout','-modulus'])
            n=int(raw.decode().strip().split('=',1)[1],16)
            keys={'keys':[{'kid':'native','kty':'RSA','use':'sig','alg':'RS256',
                           'n':encode(n.to_bytes(256,'big')),'e':'AQAB'}]}
            value=intent()
            claims={'iss':'https://token.actions.githubusercontent.com',
                    'aud':'urn:pc-crop:api-only-release:4637:'+c.digest(value),
                    'repository':'pachaninm-lab/pachanin-demo','repository_id':'1203022077',
                    'repository_owner':'pachaninm-lab','repository_owner_id':'263435807',
                    'actor':'pachaninm-lab','actor_id':'263435807','event_name':'issue_comment',
                    'ref':'refs/heads/main','sha':value['target_sha'],
                    'workflow_ref':'pachaninm-lab/pachanin-demo/.github/workflows/production-api-only-release.yml@refs/heads/main',
                    'workflow_sha':value['target_sha'],'run_id':value['run_id'],'run_attempt':'1',
                    'runner_environment':'github-hosted','iat':900,'nbf':900,'exp':1100}
            def sign(payload):
                body=encode(c.canonical({'alg':'RS256','typ':'JWT','kid':'native'}))+'.'+encode(c.canonical(payload))
                signature=subprocess.check_output(['/usr/bin/openssl','dgst','-sha256','-sign',str(key)],
                                                  input=body.encode())
                return body+'.'+encode(signature)
            token=sign(claims)
            self.assertTrue(c.verify_workflow_identity(token,value,1000,keys=keys))
            for field,bad in [('aud','arbitrary'),('sha','f'*40),('actor','attacker'),
                              ('ref','refs/heads/feature'),('workflow_sha','b'*40),
                              ('workflow_ref','attacker/workflow'),('run_id','999'),
                              ('run_attempt','2'),('event_name','pull_request'),
                              ('runner_environment','self-hosted'),('exp',999)]:
                changed=dict(claims);changed[field]=bad
                with self.subTest(field=field),self.assertRaises(c.ReleaseError):
                    c.verify_workflow_identity(sign(changed),value,1000,keys=keys)
            parts=token.split('.')
            tampered=parts[0]+'.'+encode(c.canonical({**claims,'actor':'attacker'}))+'.'+parts[2]
            with self.assertRaisesRegex(c.ReleaseError,'OIDC_SIGNATURE'):
                c.verify_workflow_identity(tampered,value,1000,keys=keys)
            changed=copy.deepcopy(value);changed['image_unpacked_bytes']+=1
            with self.assertRaisesRegex(c.ReleaseError,'OIDC_CLAIM_BINDING'):
                c.verify_workflow_identity(token,changed,1000,keys=keys)

    def test_oidc_rejects_no_token_header_injection_and_untrusted_key(self):
        with self.assertRaises(c.ReleaseError):
            c.verify_workflow_identity(None, intent(), 1000, keys={'keys': []})
        encode = lambda value: __import__('base64').urlsafe_b64encode(c.canonical(value)).decode().rstrip('=')
        for header in ({'alg': 'none', 'typ': 'JWT', 'kid': 'x'},
                       {'alg': 'RS256', 'typ': 'JWT', 'kid': 'x', 'jku': 'https://attacker.invalid'}):
            with self.assertRaises(c.ReleaseError):
                c.verify_workflow_identity(encode(header) + '.' + encode({}) + '.AA',
                                           intent(), 1000, keys={'keys': []})


class OracleLedger(unittest.TestCase):
    def row(self,name='0001_postgresql_initial',checksum='2d3708fa99e4ee855c7b9fe69dc4e4506a317ffed34330e3955f5e995d35ffdd',**change):
        return {'migration_name':name,'checksum':checksum,'finished':True,'rolled_back':False,'steps':1,**change}

    def manifest(self):return {'0001_postgresql_initial':'2d3708fa99e4ee855c7b9fe69dc4e4506a317ffed34330e3955f5e995d35ffdd'}

    def test_exact_canonical(self):c.verify_oracle_ledger([self.row()],self.manifest())
    def test_exact_redundant_marker(self):c.verify_oracle_ledger([self.row(),self.row(checksum='grainflow_v3_initial_postgresql')],self.manifest())
    def test_no_marker_without_canonical(self):
        with self.assertRaises(c.ReleaseError):c.verify_oracle_ledger([self.row(checksum='grainflow_v3_initial_postgresql')],self.manifest())
    def test_third_duplicate_rejected(self):
        with self.assertRaises(c.ReleaseError):c.verify_oracle_ledger([self.row(),self.row(),self.row(checksum='grainflow_v3_initial_postgresql')],self.manifest())
    def test_other_marker_rejected(self):
        with self.assertRaises(c.ReleaseError):c.verify_oracle_ledger([self.row(),self.row(checksum='OTHER')],self.manifest())
    def test_unfinished_marker_rejected(self):
        with self.assertRaises(c.ReleaseError):c.verify_oracle_ledger([self.row(),self.row(checksum='grainflow_v3_initial_postgresql',finished=False)],self.manifest())
    def test_rolled_marker_rejected(self):
        with self.assertRaises(c.ReleaseError):c.verify_oracle_ledger([self.row(),self.row(checksum='grainflow_v3_initial_postgresql',rolled_back=True)],self.manifest())
    def test_wrong_initial_source_rejected(self):
        with self.assertRaises(c.ReleaseError):c.verify_oracle_ledger([self.row(),self.row(checksum='grainflow_v3_initial_postgresql')],{'0001_postgresql_initial':'a'*64})


class OracleSQLShape(unittest.TestCase):
    def test_no_raw_acl_text_or_owner_identifier(self):
        self.assertNotIn('relacl::text',c.CATALOG_SQL)
        self.assertNotIn('proacl::text',c.CATALOG_SQL)
        self.assertNotIn('pg_get_userbyid',c.CATALOG_SQL)
        self.assertIn('aclexplode',c.CATALOG_SQL)
    def test_source_role_parameters_and_migration_owner(self):
        self.assertIn('rolname=$1::text',c.CATALOG_SQL)
        self.assertIn('rolname=$2::text',c.CATALOG_SQL)
        self.assertIn("THEN 'MIGRATION_OWNER'",c.CATALOG_SQL)
    def test_no_unexpanded_sql_tokens(self):
        for token in ('SCHEMAS','OWNER_N','OWNER_C','ACL_N','ACL_C','ROLE_SELF','ROLE_MEMBER'):
            self.assertNotIn(token,c.CATALOG_SQL+c.PRINCIPAL_SQL)
    def test_scope_qualifies_names_and_privileges(self):
        for token in ('schema_privileges','sequence_privileges','routine_privileges','same_session_user','session_bypass'):
            self.assertIn(token,c.PRINCIPAL_SQL)
        self.assertIn('q.schema,q.table_name',c.CATALOG_SQL)
        self.assertIn('daticulocale',c.CATALOG_SQL)
        self.assertIn('s.seqmax::text',c.CATALOG_SQL)
    def test_program_digests_deterministic(self):
        self.assertEqual(c.oracle_query_sha256(),c.oracle_query_sha256())
        self.assertNotEqual(c.database_program('default'),c.database_program('registration'))
    def test_no_arbitrary_client(self):
        with self.assertRaises(ValueError):c.database_program('OTHER')


class ActualNodeControl(unittest.TestCase):
    def execute(self,client,initial=None,fail=False):
        # Actual embedded Node is executed. Only installed Prisma exports and
        # SQL transport are injected; this is not actual PostgreSQL evidence.
        harness=r'''
const vm=require('node:vm');const input=JSON.parse(process.argv[1]);
const calls=[];const settings=input.initial||{row_security:'on',search_path:'"$user", public',default_transaction_read_only:'off',default_transaction_isolation:'read committed',session_replication_role:'origin'};
class PrismaClient {
 constructor(){this.scope='default';}
 async $transaction(fn,limits){
  if(limits.isolationLevel!=='RepeatableRead'||limits.timeout!==12000)throw Error('LIMITS');
  let read=false,normal=false;const scope=this.scope;
  return fn({
   $executeRawUnsafe:async sql=>{
    calls.push(sql);if(!read&&sql!=='SET TRANSACTION READ ONLY')throw Error('READONLY_FIRST');
    if(sql==='SET TRANSACTION READ ONLY')read=true;
    if(sql==='SET LOCAL row_security=on')normal=true;
   },
   $queryRawUnsafe:async(sql,...args)=>{
    if(!read)throw Error('UNSAFE');
    if(sql.includes('default_transaction_isolation')){
      if(normal)throw Error('INITIAL_WAS_NORMALIZED');return [{...settings}];
    }
    if(sql==='SELECT current_user::text AS role')return [{role:scope==='default'?'private_deal_SENTINEL':'private_auth_SENTINEL'}];
    if(sql.includes('migration_name,checksum')){
      if(scope==='registration')throw Error('AUTH_LEDGER_SELECT_FORBIDDEN');
      return [{migration_name:'fixture',checksum:'a'.repeat(64),finished:true,rolled_back:false,steps:1}];
    }
    if(sql.includes('schema_privileges')){
      if(args[0]!=='private_deal_SENTINEL'||args[1]!=='private_auth_SENTINEL')throw Error('ALIAS_BINDING');
      return [{value:{name:scope==='default'?'DEAL_RUNTIME':'AUTH_RUNTIME',row_security:'on',super:false,bypass:false}}];
    }
    if(sql.includes("'columns'")){
      if(input.fail)throw Error('PRIVATE_FAILURE_SENTINEL');
      return [{value:{profile:{postgres_major:16,encoding:'UTF8'},columns:[{schema:'public',table_name:'fixture'}]}}];
    }
    if(sql.includes("current_setting('transaction_read_only') AS ro"))return [{ro:'on'}];
    throw Error('UNEXPECTED_QUERY');
   }
  });
 }
 async $disconnect(){}
}
class AuthPrismaService extends PrismaClient{constructor(){super();this.scope='registration';}}
vm.runInNewContext(process.argv[2],{require:name=>{
 if(name==='@prisma/client')return {PrismaClient};
 if(name==='/app/dist/apps/api/src/modules/auth/auth-prisma.service.js')return {AuthPrismaService};
 throw Error('UNEXPECTED_MODULE');},process,setTimeout,clearTimeout});
'''
        return subprocess.run(['node','-e',harness,json.dumps({'initial':initial,'fail':fail}),c.database_program(client)],
                              stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=5)

    def test_actual_default_program(self):
        result=self.execute('default');self.assertEqual(result.returncode,0,result.stderr)
        self.assertEqual(json.loads(result.stdout)['principal']['name'],'DEAL_RUNTIME')
        self.assertNotIn(b'private_deal_SENTINEL',result.stdout)
    def test_actual_auth_program(self):
        result=self.execute('registration');self.assertEqual(result.returncode,0,result.stderr)
        value=json.loads(result.stdout);self.assertEqual(value['principal']['name'],'AUTH_RUNTIME')
        self.assertIs(value['ledger'],None)
    def test_initial_unsafe_settings_are_not_normalized_away(self):
        initial={'row_security':'off','search_path':'untrusted,public','default_transaction_read_only':'on',
          'default_transaction_isolation':'serializable','session_replication_role':'replica'}
        result=self.execute('default',initial);self.assertEqual(result.returncode,0,result.stderr)
        p=json.loads(result.stdout)['principal'];self.assertEqual(p['row_security'],'on');self.assertEqual(p['initial_settings'],initial)
    def test_actual_error_protocol_redacts(self):
        result=self.execute('registration',fail=True);self.assertEqual(result.returncode,1)
        self.assertEqual(result.stdout,b'');self.assertEqual(result.stderr,b'')


class RestoreDrillPreservationTests(unittest.TestCase):
    @contextlib.contextmanager
    def fixture(self):
        self.assertEqual(os.geteuid(), 0, 'Use the existing documented sudo test invocation')
        with tempfile.TemporaryDirectory(prefix='pc-api-drill-lock-', dir='/run') as folder:
            root = Path(folder)
            (root / 'ir20').mkdir(mode=0o700)
            lock = root / 'ir20/.drill.lock'
            lock.write_bytes(b'')
            lock.chmod(0o600)
            os.utime(lock, ns=(1000000000, 1000000000))
            host = object.__new__(c.Host)
            host.preserved_ciphers_verified = True
            original = c.BACKUPS
            c.BACKUPS = folder
            try:
                yield root, lock, host
            finally:
                c.BACKUPS = original

    def test_pinned_drill_can_reopen_existing_empty_lock(self):
        import hashlib
        drill = PATH.with_name('ir20-restore-drill.sh').read_bytes()
        self.assertEqual(hashlib.sha256(drill).hexdigest(), c.BACKUP_SHA256)
        lock_line = next(line for line in drill.decode().splitlines()
                         if line.startswith('exec 9>') and '$ROOT/.drill.lock' in line)
        with self.fixture() as (root, lock, host):
            before = lock.stat()
            baseline = host.preservation()
            subprocess.run(['/usr/bin/bash', '-c', 'set -euo pipefail\n' + lock_line + '\nflock -n 9\n'],
                           env={**os.environ, 'ROOT': str(root / 'ir20')},
                           capture_output=True, timeout=5, check=True)
            self.assertNotEqual(lock.stat().st_mtime_ns, before.st_mtime_ns)
            self.assertEqual(host.preservation(), baseline)

    def test_timestamp_exception_requires_exact_safe_empty_lock(self):
        for kind in ('nonempty', 'hardlink', 'symlink', 'directory'):
            with self.subTest(kind=kind), self.fixture() as (root, lock, host):
                if kind == 'nonempty':
                    lock.write_bytes(b'not an empty synchronization inode')
                elif kind == 'hardlink':
                    os.link(lock, root / 'second-link')
                elif kind == 'symlink':
                    lock.unlink()
                    lock.symlink_to(root / 'missing')
                else:
                    lock.unlink()
                    lock.mkdir(mode=0o700)
                with self.assertRaises(c.ReleaseError):
                    host.preservation()

    def test_existing_lock_identity_permissions_and_empty_size_remain_preserved(self):
        for kind in ('inode', 'mode', 'size'):
            with self.subTest(kind=kind), self.fixture() as (root, lock, host):
                host.preservation()
                held = os.open(lock, os.O_RDONLY | os.O_NOFOLLOW)
                try:
                    if kind == 'inode':
                        lock.unlink()
                        lock.write_bytes(b'')
                        lock.chmod(0o600)
                    elif kind == 'mode':
                        lock.chmod(0o640)
                    else:
                        lock.write_bytes(b'x')
                    with self.assertRaisesRegex(c.ReleaseError, 'PRESERVED_JOURNAL_KEY_OR_COPY_CHANGED'):
                        host.preservation()
                finally:
                    os.close(held)

    def test_retained_keys_journals_and_other_locks_keep_full_timestamp_checks(self):
        for name in ('passphrase', 'receipt.json', 'ir20/other.lock'):
            with self.subTest(name=name), self.fixture() as (root, lock, host):
                path = root / name
                path.write_bytes(b'unchanged contents')
                path.chmod(0o600)
                os.utime(path, ns=(1000000000, 1000000000))
                host.preservation()
                os.utime(path, ns=(2000000000, 2000000000))
                with self.assertRaisesRegex(c.ReleaseError, 'PRESERVED_JOURNAL_KEY_OR_COPY_CHANGED'):
                    host.preservation()


if __name__ == '__main__':
    unittest.main()
