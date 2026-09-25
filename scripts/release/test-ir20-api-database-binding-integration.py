#!/usr/bin/env python3
"""Real PostgreSQL marker semantics on disposable GitHub-hosted fixtures only.

The API transport is psql, NOT the production Prisma/API image. The production
source-query implementation and container identity checks execute unchanged.
"""
import importlib.util
import json
import os
import pathlib
import re
import secrets
import subprocess
import time

ROOT = pathlib.Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location('binding', pathlib.Path(__file__).with_name('ir20-api-database-binding.py'))
binding = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(binding)


class PsqlSession:
    def __init__(self, api, marker, database):
        self.child = binding.Process(binding.DOCKER + [
            'exec', '-i', '-e', 'PGPASSWORD=ir20-synthetic-fixture-only', api,
            'psql', '-h', 'binding-source', '-U', 'postgres', '-d', database,
            '-XqAt', '-w', '-v', 'ON_ERROR_STOP=1'], 12)
        self.child.send(("BEGIN READ ONLY; SET LOCAL statement_timeout='3s'; "
                         "SET LOCAL idle_in_transaction_session_timeout='8s'; "
                         f"SET LOCAL application_name='{marker}'; "
                         "SELECT json_build_object('pid',pg_backend_pid(),"
                         "'marker',current_setting('application_name'));\n").encode())

    def read(self, line=False):
        return self.child.read(line)

    def finish(self, data=b''):
        if data != b'release\n':
            raise RuntimeError('FIXTURE_PROTOCOL')
        return self.child.finish(b'ROLLBACK;\n\\echo RELEASED\n')

    def close(self):
        self.child.close()


class FixtureRuntime(binding.Runtime):
    def __init__(self, database='binding_fixture'):
        self.database = database

    def session(self, api, marker):
        return PsqlSession(api, marker, self.database)


def command(arguments, seconds=30, check=True):
    # Test fixture logs contain synthetic values only; never transport production
    # credentials into this job. Every created object is random-name and labelled.
    return subprocess.run(binding.DOCKER + arguments, check=check,
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                          timeout=seconds, env=binding.ENV).stdout.decode().strip()


def main():
    if (os.environ.get('GITHUB_ACTIONS') != 'true' or
            os.environ.get('RUNNER_ENVIRONMENT') != 'github-hosted' or
            os.environ.get('GITHUB_EVENT_NAME') not in ('pull_request', 'push')):
        raise RuntimeError('DISPOSABLE_GITHUB_HOSTED_FIXTURE_REQUIRED')
    authority = json.loads((ROOT / '.github/container-images/postgres-16.v1.json').read_text())
    if (authority['verification_status'] != 'VERIFIED' or
            authority['mirrored_repository'] != 'ghcr.io/pachaninm-lab/ci-postgres' or
            not re.fullmatch(r'sha256:[0-9a-f]{64}', authority['mirrored_digest'])):
        raise RuntimeError('PINNED_POSTGRES_AUTHORITY_REQUIRED')
    image = authority['mirrored_repository'] + '@' + authority['mirrored_digest']
    # The workflow pulls the exact recorded image using its read-only package
    # token before this process strips inherited environment/credential settings.
    command(['image', 'inspect', image])
    nonce = secrets.token_hex(12)
    project = 'ir20-binding-' + nonce
    network = project
    label = 'pc-crop.ir20-binding-fixture=' + nonce
    names, ids = [], {}
    network_created = False
    try:
        command(['network', 'create', '--internal', '--label', label, network])
        network_created = True
        for role in ('source', 'other', 'api'):
            name = project + '-' + role
            names.append(name)
            arguments = ['run', '-d', '--name', name, '--pull=never', '--network', network,
                         '--network-alias', 'binding-' + role, '--label', label,
                         '--label', 'com.docker.compose.project=' + project,
                         '--label', 'com.docker.compose.service=' + ('api' if role == 'api' else 'postgres'),
                         '--cpus', '1', '--memory', '256m', '--pids-limit', '64',
                         '--tmpfs', '/var/lib/postgresql/data:rw,nosuid,size=268435456',
                         '-e', 'POSTGRES_USER=postgres', '-e', 'POSTGRES_DB=binding_fixture',
                         '-e', 'POSTGRES_PASSWORD=ir20-synthetic-fixture-only']
            if role == 'api':
                arguments += ['--entrypoint', 'sleep', image, '180']
            else:
                arguments += [image]
            identity = command(arguments)
            if not binding.HEX_ID.fullmatch(identity):
                raise RuntimeError('FIXTURE_CONTAINER_ID')
            ids[role] = identity
        for role in ('source', 'other'):
            for attempt in range(30):
                ready = subprocess.run(binding.DOCKER + ['exec', ids[role], 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'binding_fixture'],
                                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                       timeout=5, env=binding.ENV)
                if ready.returncode == 0:
                    break
                time.sleep(1)
            else:
                raise RuntimeError('FIXTURE_POSTGRES_NOT_READY')
        target = 'a' * 40
        report = binding.bind(target, ids['api'], ids['source'], project, FixtureRuntime())
        if report['api_default_database_binding'] != 'VERIFIED_LIVE_BACKEND_MARKER':
            raise RuntimeError('POSITIVE_CHALLENGE_FAILED')
        # A different database in the same cluster and an identically named
        # database in another cluster must both be rejected by the actual query.
        for source, runtime in ((ids['source'], FixtureRuntime('postgres')),
                                (ids['other'], FixtureRuntime())):
            try:
                binding.bind(target, ids['api'], source, project, runtime)
            except binding.BindingError as exc:
                if str(exc) != 'DATABASE_BINDING_NOT_PROVEN':
                    raise
            else:
                raise RuntimeError('WRONG_DATABASE_ACCEPTED')
    finally:
        cleanup_errors = []
        for name in reversed(names):
            try:
                rows = json.loads(command(['container', 'inspect', name]))
                item = rows[0]
                if (len(rows) != 1 or not binding.HEX_ID.fullmatch(item['Id']) or
                        item['Config']['Labels'].get('pc-crop.ir20-binding-fixture') != nonce):
                    raise RuntimeError('FIXTURE_CLEANUP_IDENTITY')
                command(['rm', '-fv', item['Id']])
                if command(['ps', '-aq', '--no-trunc', '--filter', 'id=' + item['Id']]):
                    raise RuntimeError('FIXTURE_CLEANUP_NOT_PROVEN')
            except Exception as exc:
                cleanup_errors.append(type(exc).__name__)
        if network_created:
            try:
                rows = json.loads(command(['network', 'inspect', network]))
                if len(rows) != 1 or rows[0]['Labels'].get('pc-crop.ir20-binding-fixture') != nonce:
                    raise RuntimeError('FIXTURE_NETWORK_IDENTITY')
                command(['network', 'rm', rows[0]['Id']])
            except Exception as exc:
                cleanup_errors.append(type(exc).__name__)
        if cleanup_errors:
            raise RuntimeError('FIXTURE_CLEANUP_FAILED:' + ','.join(cleanup_errors))

    print(json.dumps({'real_postgresql_marker_cases': 3, 'result': 'PASS',
                      'api_transport': 'PSQL_FIXTURE_NOT_PRODUCTION_PRISMA_IMAGE',
                      'deployment_authorized': False}))


if __name__ == '__main__':
    main()
