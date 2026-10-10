#!/usr/bin/env bash
set -Eeuo pipefail
python3 -I - "$(dirname "$0")/production-like-kubernetes-kafka-storage.sh" <<'PY_TEST'
import copy
import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock

source = Path(sys.argv[1]).read_text()
code = source.split("<<'PY_KAFKA_STORAGE'\n", 1)[1].rsplit('\nPY_KAFKA_STORAGE', 1)[0]
agent = {'__name__': 'storage_contract_test'}
exec(compile(code, '<kafka-storage>', 'exec'), agent)
NS, CLAIM, DATA = agent['NS'], agent['CLAIM'], agent['DATA']
SHA = 'a' * 40


def fixture(persistent=True):
    volume = {'name': 'data', 'persistentVolumeClaim': {'claimName': CLAIM}} if persistent else {
        'name': 'data', 'emptyDir': {'sizeLimit': '2Gi'}}
    spec = {'volumes': [volume], 'containers': [{'name': 'kafka',
            'volumeMounts': [{'name': 'data', 'mountPath': DATA}],
            'env': [{'name': 'KAFKA_LOG_DIRS', 'value': DATA}]}]}
    deployment = {'metadata': {'name': 'kafka'}, 'spec': {'replicas': 1,
                  'strategy': {'type': 'Recreate'}, 'template': {'spec': spec}}}
    pods = {'items': [{'metadata': {'name': 'kafka-test', 'uid': 'pod-1'},
                       'spec': copy.deepcopy(spec), 'status': {'phase': 'Running',
                       'conditions': [{'type': 'Ready', 'status': 'True'}]}}]}
    claim = {'metadata': {'name': CLAIM, 'namespace': NS, 'uid': 'claim-1'},
             'status': {'phase': 'Bound'}, 'spec': {'storageClassName': 'standard',
             'accessModes': ['ReadWriteOnce'], 'resources': {'requests': {'storage': '2Gi'}},
             'volumeName': 'pv-1'}}
    pv = {'metadata': {'name': 'pv-1', 'uid': 'pv-uid-1'}, 'status': {'phase': 'Bound'},
          'spec': {'storageClassName': 'standard',
                   'claimRef': {'name': CLAIM, 'namespace': NS, 'uid': 'claim-1'}}}
    return deployment, pods, claim, pv


class FakeCluster:
    def __init__(self, fail_at=None, topics=''):
        self.deployment, self.pods, self.claim, self.pv = fixture(False)
        self.calls, self.fail_at, self.topics = [], fail_at, topics
        self.created = False
        self.marker = None

    def __call__(self, *args, payload=None, timeout=30):
        self.calls.append(args)
        if len(self.calls) == self.fail_at:
            raise ValueError('KAFKA_STORAGE_COMMAND_FAILED')
        verb = args[0]
        if verb == 'get':
            kind = args[1]
            if kind == 'deployments': value = {'items': [self.deployment]}
            elif kind == 'deployment': value = self.deployment
            elif kind == 'pods': value = self.pods
            elif kind == 'storageclass': value = {'provisioner': 'rancher.io/local-path',
                 'volumeBindingMode': 'WaitForFirstConsumer', 'reclaimPolicy': 'Delete'}
            elif kind == 'pvc':
                if '--ignore-not-found' in args and not self.created: return ''
                value = self.claim
            elif kind == 'pv': value = self.pv
            else: raise AssertionError(args)
            return json.dumps(value)
        if verb == 'create':
            assert not self.created and json.loads(payload)['metadata']['name'] == CLAIM
            self.created = True
        elif verb == 'scale':
            assert args[1] == 'deployment/kafka'
            count = int(args[-1].split('=')[1])
            self.deployment['spec']['replicas'] = count
            if not count: self.pods['items'] = []
            else:
                self.pods = fixture()[1]
                self.pods['items'][0]['spec'] = copy.deepcopy(self.deployment['spec']['template']['spec'])
                self.pods['items'][0]['metadata']['uid'] = 'pod-2'
        elif verb == 'patch':
            assert args[1:3] == ('deployment', 'kafka')
            patch = json.loads(args[-1])
            assert patch[0] == {'op': 'test', 'path': '/spec/replicas', 'value': 0}
            assert patch[1]['value'] == self.deployment['spec']['template']
            assert patch[2]['path'] == '/spec/template/spec/volumes/0'
            self.deployment['spec']['template']['spec']['volumes'][0] = patch[2]['value']
        elif verb == 'exec':
            if 'kafka-topics' in args: return self.topics
            if 'bash' in args:
                assert args[-2] == agent['MARKER']
                self.marker = args[-1]
            elif 'sha256sum' in args:
                assert self.marker is not None
                return 'b' * 64 + '  ' + DATA + '/meta.properties\n' + hashlib.sha256(self.marker.encode()).hexdigest() + '  ' + agent['MARKER']
            else: raise AssertionError(args)
        elif verb not in ('wait', 'rollout'): raise AssertionError(args)
        return ''


class StorageTests(unittest.TestCase):
    def test_bound_storage_snapshot(self):
        identity, pod = agent['validate_snapshot'](*fixture())
        self.assertEqual(identity['claim_uid'], 'claim-1')
        self.assertEqual(pod, 'kafka-test')

    def test_emptydir_never_passes_persistence_validation(self):
        with self.assertRaises(ValueError): agent['validate_snapshot'](*fixture(False))

    def test_log_directory_and_mount_must_match_the_volume(self):
        for mode in ('mount', 'log-dir', 'read-only', 'duplicate'):
            with self.subTest(mode=mode):
                values = fixture(); spec = values[0]['spec']['template']['spec']
                if mode == 'mount': spec['containers'][0]['volumeMounts'][0]['mountPath'] = '/wrong'
                elif mode == 'log-dir': spec['containers'][0]['env'][0]['value'] = '/wrong'
                elif mode == 'read-only': spec['volumes'][0]['persistentVolumeClaim']['readOnly'] = True
                else: spec['volumes'].append(copy.deepcopy(spec['volumes'][0]))
                with self.assertRaises(ValueError): agent['validate_snapshot'](*values)

    def test_unbound_foreign_or_replaced_claim_is_rejected(self):
        for mode in ('pending', 'foreign', 'changed-uid', 'wrong-class', 'wrong-size'):
            with self.subTest(mode=mode):
                values = fixture(); claim, pv = values[2:]
                if mode == 'pending': claim['status']['phase'] = 'Pending'
                elif mode == 'foreign': pv['spec']['claimRef']['namespace'] = 'production'
                elif mode == 'changed-uid': pv['spec']['claimRef']['uid'] = 'new'
                elif mode == 'wrong-class': claim['spec']['storageClassName'] = 'paid-provider'
                else: claim['spec']['resources']['requests']['storage'] = '20Gi'
                with self.assertRaises(ValueError): agent['validate_snapshot'](*values)

    def test_unready_deleting_or_duplicate_pods_are_rejected(self):
        for mode in ('unready', 'deleting', 'duplicate'):
            with self.subTest(mode=mode):
                values = fixture(); pods = values[1]['items']
                if mode == 'unready': pods[0]['status']['conditions'][0]['status'] = 'False'
                elif mode == 'deleting': pods[0]['metadata']['deletionTimestamp'] = 'now'
                else: pods.append(copy.deepcopy(pods[0]))
                with self.assertRaises(ValueError): agent['validate_snapshot'](*values)

    def test_only_a_replaced_pod_with_unchanged_data_proves_continuity(self):
        before = {'claim_uid': 'claim', 'pv_uid': 'pv', 'volume_name': 'v', 'pod_uid': 'old', 'data_hashes': ['a', 'b']}
        after = dict(before, pod_uid='new')
        agent['compare'](before, after)
        for key in before:
            bad = copy.deepcopy(after)
            bad[key] = before[key] if key == 'pod_uid' else 'changed'
            with self.subTest(key=key), self.assertRaises(ValueError): agent['compare'](before, bad)

    def test_actual_prepare_orders_pristine_check_before_any_write(self):
        fake = FakeCluster()
        with mock.patch.dict(agent, kube=fake): result = agent['prepare']()
        self.assertEqual(result['pod_uid'], 'pod-2')
        verbs = [v[0] for v in fake.calls]
        self.assertLess(next(i for i, v in enumerate(fake.calls) if 'kafka-topics' in v), verbs.index('create'))
        self.assertLess(verbs.index('scale'), verbs.index('patch'))
        self.assertIn(('get', 'pods', '-l', agent['SELECTOR'], '-o', 'json'),
                      fake.calls[verbs.index('scale') + 1:verbs.index('patch')])
        self.assertTrue(all(v[1] == 'deployment/kafka' for v in fake.calls if v[0] == 'scale'))
        self.assertNotIn('delete', verbs)

    def test_existing_topic_prevents_all_storage_mutations(self):
        fake = FakeCluster(topics='grainflow.domain.events')
        with mock.patch.dict(agent, kube=fake), self.assertRaisesRegex(ValueError, 'BOOTSTRAP_NOT_EMPTY'):
            agent['prepare']()
        self.assertTrue(all(v[0] in ('get', 'exec') for v in fake.calls))

    def test_existing_application_deployment_prevents_all_storage_mutations(self):
        fake = FakeCluster(); fake.deployment['metadata']['name'] = 'grainflow-api'
        with mock.patch.dict(agent, kube=fake), self.assertRaisesRegex(ValueError, 'APPLICATION_ALREADY_CREATED'):
            agent['prepare']()
        self.assertEqual([v[0] for v in fake.calls], ['get'])

    def test_each_prepare_command_failure_stops_without_retry_or_success(self):
        good = FakeCluster()
        with mock.patch.dict(agent, kube=good): agent['prepare']()
        for step in range(1, len(good.calls) + 1):
            fake = FakeCluster(fail_at=step)
            with self.subTest(step=step), mock.patch.dict(agent, kube=fake), self.assertRaises(ValueError):
                agent['prepare']()
            self.assertEqual(len(fake.calls), step)

    def test_snapshot_is_read_only(self):
        fake = FakeCluster()
        with mock.patch.dict(agent, kube=fake):
            agent['prepare'](); fake.calls.clear(); agent['snapshot']()
        self.assertTrue(all(v[0] == 'get' or (v[0] == 'exec' and 'sha256sum' in v) for v in fake.calls))

    def test_stale_run_or_changed_storage_cannot_leave_a_pass_report(self):
        env = {'EXACT_HEAD': SHA, 'GITHUB_RUN_ID': '10', 'GITHUB_RUN_ATTEMPT': '1'}
        common = {'schema': 'pc.disposable-kafka-storage.v1', 'commitSha': SHA,
                  'run_id': '10', 'run_attempt': '1', 'production_acceptance': False, 'ha_or_dr_acceptance': False}
        before = {'claim_uid': 'claim', 'pv_uid': 'pv', 'volume_name': 'v', 'pod_uid': 'old', 'data_hashes': ['a', 'b']}
        for mode in ('stale-run', 'lost-data', 'success'):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as temp:
                directory = Path(temp) / 'kubernetes/kafka-storage'; directory.mkdir(parents=True)
                baseline = dict(common, snapshot=before)
                if mode == 'stale-run': baseline['run_id'] = '9'
                (directory / 'baseline.json').write_text(json.dumps(baseline))
                (directory / 'continuity.json').write_text('{"result":"PASS"}')
                after = dict(before, pod_uid='new')
                if mode == 'lost-data': after['data_hashes'] = ['new', 'new']
                def command(args, *a, **k):
                    return SHA if args[0] == 'git' else agent['CONTEXT'] if args[0] == 'kubectl' else NS
                with mock.patch.dict(os.environ, dict(env, EVIDENCE_DIR=temp)), mock.patch.dict(agent,
                    command=command, get=lambda *a: {'metadata': {'labels': {'environment': 'production-like'}}},
                    snapshot=lambda: after):
                    if mode == 'success': agent['main']('verify')
                    else:
                        with self.assertRaises(ValueError): agent['main']('verify')
                result = json.loads((directory / 'continuity.json').read_text())
                self.assertEqual(result['result'], 'PASS' if mode == 'success' else 'FAIL')
                self.assertFalse(result['production_acceptance'])


unittest.main(argv=['kafka-storage-contract'], verbosity=2)
PY_TEST
