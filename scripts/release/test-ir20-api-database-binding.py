#!/usr/bin/env python3
"""Synthetic rejection matrix and actual subprocess/Node protocol tests.

No database, API image or production access is used by this suite.
"""
import contextlib
import copy
import importlib.util
import io
import json
import pathlib
import shutil
import sys
import unittest
from unittest.mock import patch

PATH = pathlib.Path(__file__).with_name('ir20-api-database-binding.py')
SPEC = importlib.util.spec_from_file_location('binding', PATH)
binding = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(binding)
TARGET, API, SOURCE, PROJECT = 'a' * 40, 'b' * 64, 'c' * 64, 'canonical-project'


def container(identity, service):
    return {'Id': identity, 'Image': 'sha256:' + 'd' * 64,
            'State': {'Running': True, 'StartedAt': 'fixed', 'Pid': 33},
            'RestartCount': 0, 'HostConfig': {}, 'Mounts': [], 'NetworkSettings': {},
            'Config': {'Labels': {'com.docker.compose.project': PROJECT,
                                  'com.docker.compose.service': service},
                       'Env': ['PG_MAJOR=16', 'POSTGRES_USER=postgres', 'POSTGRES_DB=grain',
                               'DATABASE_URL=do-not-publish-a-dsn']}}


class Session:
    def __init__(self, marker, runtime):
        self.identity = {'pid': 4321, 'marker': marker}
        self.runtime = runtime
        self.closed = False

    def read(self, line=False):
        assert line
        self.runtime.change_identity(self.identity)
        return self.runtime.identity_bytes or json.dumps(self.identity).encode()

    def finish(self, data=b''):
        assert data == b'release\n'
        self.runtime.released = True
        if self.runtime.finish_error:
            raise binding.BindingError('PROCESS_FAILED')
        return self.runtime.receipt

    def close(self):
        self.closed = True


class Runtime:
    def __init__(self):
        self.initial = {API: container(API, 'api'), SOURCE: container(SOURCE, 'postgres')}
        self.counts = {API: 0, SOURCE: 0}
        self.change_after = lambda value: None
        self.change_identity = lambda value: None
        self.identity_bytes = b''
        self.receipt = b'RELEASED\n'
        self.proof = b'1\n'
        self.finish_error = False
        self.released = False
        self.child = None
        self.calls = []

    def inspect(self, identity):
        result = copy.deepcopy(self.initial[identity])
        self.counts[identity] += 1
        if self.counts[identity] > 1:
            self.change_after(result)
        return result

    def session(self, api, marker):
        assert api == API
        self.child = Session(marker, self)
        return self.child

    def run(self, argv, data=b''):
        self.calls.append((argv, data))
        return self.proof


class BindingTests(unittest.TestCase):
    def setUp(self):
        self.runtime = Runtime()

    def call(self, *args):
        return binding.bind(*(args or (TARGET, API, SOURCE, PROJECT)), self.runtime)

    def rejects(self):
        with self.assertRaises((binding.BindingError, KeyError, TypeError)):
            self.call()
        if self.runtime.child:
            self.assertTrue(self.runtime.child.closed)

    def test_success_is_only_default_database_binding(self):
        result = self.call()
        self.assertEqual(result['api_default_database_binding'], 'VERIFIED_LIVE_BACKEND_MARKER')
        self.assertEqual(result['canonical_api_identity'], 'CALLER_REQUIRED_NOT_PROVEN')
        for key in ('deployment_authorized', 'restore_authorized', 'backup_created'):
            self.assertIs(result[key], False)
        self.assertTrue(self.runtime.released)
        text = json.dumps(result)
        for forbidden in ('do-not-publish', 'postgres', 'grain', PROJECT, API, SOURCE, '4321'):
            self.assertNotIn(forbidden, text)

    def test_invalid_arguments_never_start_session(self):
        for args in [(TARGET, API, API, PROJECT), ('x'*40, API, SOURCE, PROJECT),
                     (TARGET, 'b'*12, SOURCE, PROJECT), (TARGET, API, SOURCE, '../bad')]:
            with self.subTest(args=args), self.assertRaises(binding.BindingError):
                self.call(*args)
        self.assertIsNone(self.runtime.child)

    def test_wrong_source_identity(self):
        self.runtime.initial[SOURCE]['Id'] = 'e'*64
        self.rejects()

    def test_wrong_project(self):
        self.runtime.initial[SOURCE]['Config']['Labels']['com.docker.compose.project'] = 'other'
        self.rejects()

    def test_stopped_api(self):
        self.runtime.initial[API]['State']['Running'] = False
        self.rejects()

    def test_wrong_source_service(self):
        self.runtime.initial[SOURCE]['Config']['Labels']['com.docker.compose.service'] = 'redis'
        self.rejects()

    def test_duplicate_environment(self):
        self.runtime.initial[API]['Config']['Env'].append('DATABASE_URL=another-secret')
        self.rejects()

    def test_bad_image_id(self):
        self.runtime.initial[SOURCE]['Image'] = 'postgres:latest'
        self.rejects()

    def test_postgres_configuration(self):
        for value in ('PG_MAJOR=15', 'POSTGRES_USER=x;SELECT 1', 'POSTGRES_DB='):
            with self.subTest(value=value):
                self.setUp()
                key = value.split('=')[0]
                env = self.runtime.initial[SOURCE]['Config']['Env']
                env[:] = [v for v in env if not v.startswith(key+'=')] + [value]
                self.rejects()

    def test_nonmatching_database_marker(self):
        self.runtime.proof = b'0\n'
        self.rejects()
        self.assertFalse(self.runtime.released)

    def test_ambiguous_or_malformed_proof(self):
        for proof in (b'2\n', b'1\nsecret\n', b'1', b'', b' 1\n'):
            with self.subTest(proof=proof):
                self.setUp()
                self.runtime.proof = proof
                self.rejects()

    def test_wrong_nonce(self):
        self.runtime.change_identity = lambda row: row.update(marker='copied')
        self.rejects()

    def test_wrong_pid_types(self):
        for value in (True, '4321', -1, 2147483648):
            with self.subTest(value=value):
                self.setUp()
                self.runtime.change_identity = lambda row: row.update(pid=value)
                self.rejects()

    def test_duplicate_json_fields(self):
        self.runtime.identity_bytes = b'{"pid":1,"pid":2,"marker":"wrong"}'
        self.rejects()

    def test_invalid_utf8_and_json_constants(self):
        for value in (b'\xff', b'{"pid":NaN}', b'[]'):
            with self.subTest(value=value):
                self.setUp()
                self.runtime.identity_bytes = value
                self.rejects()

    def test_missing_release_receipt(self):
        self.runtime.receipt = b''
        self.rejects()

    def test_failed_transaction_completion(self):
        self.runtime.finish_error = True
        self.rejects()

    def test_restart_and_environment_drift(self):
        for change in (lambda c: c.update(RestartCount=1),
                       lambda c: c['Config']['Env'].append('NEW=secret'),
                       lambda c: c['State'].update(StartedAt='changed'),
                       lambda c: c['NetworkSettings'].update(Networks={'other': {}})):
            with self.subTest(change=change):
                self.setUp()
                self.runtime.change_after = change
                self.rejects()

    def test_health_log_refresh_is_not_runtime_drift(self):
        self.runtime.change_after = lambda c: c['State'].update(Health={'Log': ['new sample']})
        self.call()

    def test_source_probe_is_local_readonly_and_bounded(self):
        self.call()
        argv, sql = self.runtime.calls[0]
        self.assertIn(SOURCE, argv)
        self.assertIn('PGHOST=/var/run/postgresql', argv)
        self.assertIn('PGOPTIONS=-c default_transaction_read_only=on -c statement_timeout=3000', argv)
        self.assertIn('PGSERVICE', argv)
        self.assertIn(b'BEGIN READ ONLY;', sql)
        self.assertTrue(sql.endswith(b'ROLLBACK;\n'))
        self.assertIn(b"datname=current_database()", sql)
        self.assertIn(b"backend_type='client backend'", sql)
        self.assertIn(b"pid=4321", sql)

    def test_main_redacts_metadata_exceptions(self):
        with patch.object(binding.os, 'geteuid', return_value=0), \
             patch.object(binding, 'bind', side_effect=ValueError('secret DSN')), \
             contextlib.redirect_stderr(io.StringIO()) as error:
            self.assertEqual(binding.main([TARGET, API, SOURCE, PROJECT]), 1)
        self.assertEqual(error.getvalue(), 'IR20_BINDING_ERROR=EXECUTION_OR_METADATA\n')


class ProcessTests(unittest.TestCase):
    def test_real_subprocess_output_and_nonzero(self):
        for code, error in [("print('ok')", False), ("print('not proof');raise SystemExit(2)", True)]:
            process = binding.Process([sys.executable, '-I', '-c', code], 3)
            try:
                if error:
                    with self.assertRaises(binding.BindingError):
                        process.finish()
                else:
                    self.assertEqual(process.finish(), b'ok\n')
            finally:
                process.close()

    def test_real_subprocess_output_limit(self):
        process = binding.Process([sys.executable, '-I', '-c', "print('x'*1048577)"], 3)
        try:
            with self.assertRaisesRegex(binding.BindingError, 'OUTPUT_LIMIT'):
                process.finish()
        finally:
            process.close()

    def test_real_subprocess_timeout(self):
        process = binding.Process([sys.executable, '-I', '-c', 'import time;time.sleep(5)'], 0.1)
        try:
            with self.assertRaisesRegex(binding.BindingError, 'PROCESS_TIMEOUT'):
                process.finish()
        finally:
            process.close()

    def test_actual_node_protocol_with_mocked_prisma(self):
        node = shutil.which('node')
        self.assertIsNotNone(node, 'Node is required for the executable protocol test')
        # Only Prisma is replaced. The actual embedded program, pipes, Node event
        # handling and transaction-completion acknowledgement execute unchanged.
        fake = r'''
class PrismaClient {
  async $transaction(callback) { return callback(this); }
  async $executeRawUnsafe(query) { return 0; }
  async $queryRawUnsafe(query) {
    if (query.includes('pg_backend_pid')) return [{pid:4321,ro:'on',version:160004}];
    if (query.includes('transaction_read_only')) return [{ro:'on'}];
    return [{set_config:'ok'}];
  }
  async $disconnect() {}
}
'''
        code = binding.API_PROGRAM.replace("const { PrismaClient } = require('@prisma/client');", fake)
        marker = 'pc-ir20-bind-' + 'e'*32
        for release in (True, False):
            with self.subTest(release=release):
                process = binding.Process([node, '-e', code, marker], 4)
                try:
                    self.assertEqual(binding.decode(process.read(line=True)), {'pid':4321,'marker':marker})
                    if release:
                        self.assertEqual(process.finish(b'release\n'), b'RELEASED\n')
                    else:
                        with self.assertRaises(binding.BindingError):
                            process.finish()  # Lost controller pipe must fail, not acknowledge.
                finally:
                    process.close()


if __name__ == '__main__':
    unittest.main()
