#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const workflowPath='.github/workflows/tai-reg-ru-preflight.yml';
const scriptPath='scripts/tai-reg-ru-preflight.sh';
const workflow=readFileSync(workflowPath,'utf8');
const script=readFileSync(scriptPath,'utf8');
const violations=[];
const requireFragment=(source,fragment,label)=>{if(!source.includes(fragment))violations.push(`${label}: missing ${JSON.stringify(fragment)}`)};
const forbid=(source,pattern,label)=>{if(pattern.test(source))violations.push(label)};

for(const fragment of [
  'workflow_run:','workflows: ["Build & Publish Canonical Docker Images"]',
  "inputs.confirmation == 'PREFLIGHT-TAI-REG-RU'",'github.actor == github.repository_owner',
  '[[ "$TARGET_SHA" == "$(git rev-parse origin/main)" ]]','runs-on: [self-hosted, linux, x64, pc-prod, tai-readonly]',
  'Verify canonical exact-SHA TAI image outside production','Execute protected read-only preflight',
  'sudo -n /usr/local/sbin/pc-tai-release-controller preflight','Upload redacted preflight evidence',
  'Publish exact-main preflight commit status',"context='TAI REG.RU Preflight'",
]) requireFragment(workflow,fragment,workflowPath);

for(const fragment of [
  'tai.reg-ru.preflight.v1','READ_ONLY_PREFLIGHT','productionMutationAllowed','snapshot_containers',
  'compose-hash.before','compose-hash.after','NO_PRODUCTION_MUTATION_DETECTED',
  'compose.tai-agro-os.override.yml','TAI_OVERRIDE_PROTECTED','TAI_OVERRIDE_PROTECTION_INVALID',
  'TAI_SERVICE_NOT_MATERIALIZED','TAI_SERVICE_DECLARED','TAI_RUNTIME_HEALTHY','TAI_RUNTIME_EXACT_MAIN','TAI_RUNTIME_ISOLATED',
  'TAI_DEDICATED_ENV_NOT_MATERIALIZED','TAI_DEDICATED_ENV_MATERIALIZED',
  'TAI_DEDICATED_DB_PRINCIPAL_NOT_ATTESTED','TAI_DEDICATED_DB_PRINCIPAL_ATTESTED',
  'TAI_READINESS_READY','TAI_READINESS_BLOCKED','API_TO_PRIVATE_MODEL_HEALTHY','API_WEB_EXACT_MAIN',
  'SET TRANSACTION READ ONLY',"namespace.nspname = 'public'",'admission.artifact_sha256 = profile.artifact_sha256',
  'ACTIVE_MODEL_IDENTITY_MATCHED','MODEL_ADMISSION_ACCEPTED','MODEL_ADMISSION_NOT_ATTESTED','ACTIVE_KNOWLEDGE_READY',
  'record_maturity','restricted_model','model_admission',
  'expected_image_id=','expected_repo_digest=','"$tai_container_image_id" == "$expected_image_id"',
  '"$tai_config_image" == "$TAI_IMAGE_DIGEST"','docker port "$tai_id"','rolinherit','has_table_privilege',
  "relation.relname NOT LIKE 'tai\\\\_%' ESCAPE '\\\\'","components.get('tools') == 'disabled-safe'",
]) requireFragment(script,fragment,scriptPath);

forbid(workflow,/PC_PROD_SSH_|PROD_HOST_SECRET|PROD_KEY_|PROD_HOST_FINGERPRINT|ssh-keyscan|id_pc_prod|prod_known_hosts/u,`${workflowPath}: production SSH transport is forbidden`);
forbid(workflow,/continue-on-error:\s*true/mu,`${workflowPath}: continue-on-error is forbidden`);
forbid(workflow,/pull_request_target:/u,`${workflowPath}: pull_request_target is forbidden`);
forbid(workflow,/actions\/checkout@v4[\s\S]{0,600}name: Exact-main REG[.]RU controller inventory/iu,`${workflowPath}: production runner must not execute repository workspace code`);

const normalized=script.replace(/^\s*#.*$/gmu,'')
  .replace("trap 'rm -rf \"$work\"' EXIT",'')
  .replaceAll("'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'","'EFFECTIVE_TABLE_PRIVILEGES'")
  .replaceAll("'USAGE,SELECT,UPDATE'","'EFFECTIVE_SEQUENCE_PRIVILEGES'");
for(const [pattern,label] of [
  [/\bdocker\s+compose\b[^\n]*(?:\bup\b|\bdown\b|\brestart\b|\bpull\b|\bcreate\b|\brm\b)/iu,'production Docker Compose mutation'],
  [/\bdocker\s+(?:start|stop|restart|kill|rm|update|run|pull)\b/iu,'production container or image mutation'],
  [/\bsystemctl\s+(?:start|stop|restart|enable|disable|daemon-reload)\b/iu,'systemd mutation'],
  [/\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE)\b/iu,'PostgreSQL mutation statement'],
  [/\b(?:install|cp|mv|chmod|chown|truncate)\s+[^\n]*\/(?:etc|srv|opt|var|home|root)\b/iu,'production filesystem mutation'],
  [/\b(?:kill|pkill|killall)\b/iu,'process mutation'],
]) forbid(normalized,pattern,`${scriptPath}: forbidden ${label}`);
forbid(script,/docker\s+inspect[^\n]*\.Config\.Env[^\n]*>\s*\/dev\/stdout/iu,`${scriptPath}: container environment must not be printed`);
forbid(script,/set\s+-[^\n]*x/iu,`${scriptPath}: shell tracing is forbidden`);
forbid(script,/(?:password|secret|api_key|database_url)\s*=.*(?:echo|printf)/iu,`${scriptPath}: secret-like values must not be printed`);
forbid(script,/^\s*ports\s*:/mu,`${scriptPath}: preflight must not define public ports`);

// Run the actual embedded optional observer against local, non-network fixtures.
const observerStart = script.indexOf("<<'PY_TOPOLOGY_OBSERVER'\n");
const observerEnd = script.indexOf('\nPY_TOPOLOGY_OBSERVER', observerStart);
const additionStart = script.indexOf('# Optional bounded observation;');
const additionEnd = script.indexOf('if (( compose_ready == 1 )); then\n  sha256sum', additionStart);
const reportAdditionStart = script.indexOf('try:\n    observer = runpy.run_path');
const reportAdditionEnd = script.indexOf('print(json.dumps(report, ensure_ascii=False', reportAdditionStart);
if ([observerStart, observerEnd, additionStart, additionEnd, reportAdditionStart, reportAdditionEnd].some((value) => value < 0)) {
  violations.push('optional topology observer boundaries are missing');
} else {
  const legacy = (script.slice(0, additionStart) + script.slice(additionEnd))
    .replace(script.slice(reportAdditionStart, reportAdditionEnd), '')
    .replace('"$checks" "$blockers" "$work"', '"$checks" "$blockers"')
    .replace('import json, sys, runpy', 'import json, sys')
    .replace('sha, image, digest, checks_path, blockers_path, work =', 'sha, image, digest, checks_path, blockers_path =');
  if (createHash('sha256').update(legacy).digest('hex') !== '6610f34c34f2dc249b0a0b7c2a3ed98f8e7b238079124aa021d501c114cc9366') {
    violations.push('legacy preflight decisions/checks/blockers/maturity/report changed outside optional observation');
  }
  const observerTests = String.raw`import ast
import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

shell_source = sys.stdin.read()
observer_source = shell_source.split("<<'PY_TOPOLOGY_OBSERVER'\n", 1)[1].split('\nPY_TOPOLOGY_OBSERVER', 1)[0]
report_source = shell_source.rsplit("<<'PY'\n", 1)[1].rsplit('\nPY', 1)[0]
ns = {'__name__': 'snapshot_contract_test'}
exec(compile(observer_source, 'embedded-snapshot-observer', 'exec'), ns)
CANARY = 'SECRET_DO_NOT_EMIT_59719a'


def fixture():
    paths = ['/private/' + CANARY + '/input-' + str(index) for index in range(45)]
    paths += [paths[4], '/private/' + CANARY + '/override.yml']
    model = {'services': {'api': {'image': 'api-' + CANARY}, 'web': {'image': 'web-' + CANARY},
        **{CANARY + '-service-' + str(index): {'image': 'aux-' + CANARY} for index in range(8)},
        'migrations': {'image': 'pc-crop-transfer/migration:' + 'a' * 40}},
        'environment': {'SECRET': CANARY}, 'include': ['oci://untrusted.invalid/' + CANARY]}
    context = ['1', '1', '0', '11', *paths]
    return context, model


def result(context=None, model=None):
    if context is None:
        context, model = fixture()
    value = ns['safely_collect'](context, model)
    ns['validate'](value)
    assert CANARY not in json.dumps(value)
    return value


def base_report():
    return {'checks': [{'name': 'mutation_guard', 'status': 'PASS', 'code': 'NO_PRODUCTION_MUTATION_DETECTED'},
                       {'name': 'topology', 'status': 'BLOCKED', 'code': 'CORE_TOPOLOGY_INCOMPLETE', 'value': '11'}],
            'blockers': ['CORE_TOPOLOGY_INCOMPLETE'], 'passed': False, 'maturity': []}


class SnapshotContract(unittest.TestCase):
    def test_complete_47_inputs_11_services_and_duplicates(self):
        context, model = fixture()
        original = copy.deepcopy((context, model))
        value = result(context, model)
        self.assertEqual((context, model), original)
        self.assertEqual(value['preflightConjuncts'], {'hasApi': True, 'hasWeb': True, 'migrationCount': 0})
        snapshot = value['preflightSnapshot']
        self.assertEqual(snapshot['inputs'], {'total': 47, 'unique': 46, 'duplicates': 1})
        self.assertEqual(snapshot['serviceCount'], 11)
        self.assertEqual([row['serviceOrdinal'] for row in snapshot['services']], list(range(1, 12)))
        self.assertEqual(snapshot['services'][-1]['matches'], {'name': False, 'image': False, 'explicitCommand': False})

    def test_no_fresh_model_or_image_or_registry_claim(self):
        value = result()
        self.assertEqual(value['classification'], 'NOT_PROVEN')
        self.assertEqual(value['registryProvenance'], 'NOT_PROVEN')
        self.assertEqual(value['preflightSnapshot']['freshness'], 'NOT_PROVEN')
        self.assertTrue(all(value[key] is None for key in ('persisted', 'releaseDiscovery', 'comparison')))
        self.assertTrue(all(row['localImage'] is None for row in value['preflightSnapshot']['services']))

    def test_no_added_process_network_or_protected_file_operations(self):
        tree = ast.parse(observer_source)
        self.assertEqual({alias.name for node in ast.walk(tree) if isinstance(node, ast.Import) for alias in node.names}, {'json', 're', 'sys'})
        self.assertFalse(any(isinstance(node, ast.ImportFrom) for node in ast.walk(tree)))
        # Collection itself must not open any Compose/env/include/daemon input.
        with patch('builtins.open', side_effect=AssertionError('No protected file read is permitted')):
            value = result()
        self.assertEqual(value['preflightSnapshot']['serviceCount'], 11)
        self.assertNotIn('subprocess', observer_source)
        self.assertNotIn('docker', observer_source.lower())

    def test_unicode_and_whitespace_paths_are_not_retrimmed(self):
        context, model = fixture()
        context[4:] = ['/base/\u00a0a.yml\u00a0', '/base/a.yml', '/base/./a.yml', '/base/a.yml']
        value = result(context, model)
        self.assertEqual(value['preflightSnapshot']['inputs'], {'total': 4, 'unique': 3, 'duplicates': 1})

    def test_each_core_conjunct_is_distinct(self):
        for name, position in (('api', 0), ('web', 1)):
            context, model = fixture()
            del model['services'][name]
            context[position] = '0'
            context[3] = '10'
            value = result(context, model)
            self.assertFalse(value['preflightConjuncts']['has' + name.title()])
            self.assertEqual(value['classification'], 'NOT_PROVEN')

    def test_original_candidate_matches_not_repaired(self):
        for service, match in (({'image': 'grainflow-migration:' + CANARY}, 'image'),
                               ({'image': 'unrelated', 'command': ['prisma', 'migrate', CANARY]}, 'explicitCommand')):
            context, model = fixture()
            model['services']['migrations'] = service
            context[2] = '1'
            value = result(context, model)
            self.assertTrue(value['preflightSnapshot']['services'][-1]['matches'][match])
            self.assertEqual(value['classification'], 'NOT_PROVEN')
        context, model = fixture()
        model['services']['migration'] = model['services'].pop('migrations')
        context[2] = '1'
        self.assertTrue(result(context, model)['preflightSnapshot']['services'][-1]['matches']['name'])

    def test_multiple_candidates_are_never_promoted(self):
        context, model = fixture()
        model['services']['migration'] = model['services'].pop('migrations')
        model['services']['second-migration'] = {'image': CANARY}
        context[2:4] = ['2', '12']
        value = result(context, model)
        self.assertEqual(value['preflightConjuncts']['migrationCount'], 2)
        self.assertEqual(value['classification'], 'NOT_PROVEN')

    def test_false_core_or_service_count_becomes_unknown(self):
        for index, value in ((0, '0'), (1, '0'), (2, '1'), (3, '12')):
            context, model = fixture()
            context[index] = value
            self.assertEqual(result(context, model), ns['unknown']())

    def test_input_and_service_limits_do_not_truncate(self):
        context, model = fixture()
        context[4:] = ['/input'] * 257
        self.assertEqual(result(context, model), ns['unknown']())
        context, model = fixture()
        model['services'].update({str(index): {} for index in range(54)})
        context[3] = '65'
        self.assertEqual(result(context, model), ns['unknown']())

    def test_malformed_models_and_commands_are_unknown(self):
        for invalid in (None, [], {'services': {}}, {'services': {'api': {'command': [1]}}}, {'services': {'api': {'image': 1}}}):
            context, _ = fixture()
            self.assertEqual(result(context, invalid), ns['unknown']())

    def test_duplicate_json_and_constants_are_rejected(self):
        for raw in (b'{"services":{},"services":{}}', b'{"x":NaN}', b'{"x":Infinity}'):
            with self.assertRaises((ns['Unproven'], ValueError)):
                ns['bounded_json'](raw, ns['MAX_MODEL_BYTES'])

    def test_typed_unknown_is_not_false_or_zero(self):
        value = ns['unknown']()
        self.assertEqual(value['preflightConjuncts'], {'hasApi': None, 'hasWeb': None, 'migrationCount': None})
        ns['validate'](value)

    def test_typed_validator_rejects_contradictions_and_raw_fields(self):
        for kind in ('extra', 'classification', 'core', 'ordinal', 'image', 'comparison', 'bool', 'snapshotBool', 'candidate'):
            value = result()
            if kind == 'extra': value['rawPath'] = CANARY
            if kind == 'classification': value['classification'] = 'OBSERVED_NOT_AUTHORITY'
            if kind == 'core': value['preflightConjuncts']['hasApi'] = False
            if kind == 'ordinal': value['preflightSnapshot']['services'][0]['serviceOrdinal'] = True
            if kind == 'image': value['preflightSnapshot']['services'][0]['localImage'] = {'Id': CANARY}
            if kind == 'comparison': value['comparison'] = {'candidateSetIdentical': True}
            if kind == 'bool': value['preflightConjuncts']['hasApi'] = 1
            if kind == 'snapshotBool': value['preflightSnapshot']['conjuncts']['hasApi'] = 1
            if kind == 'candidate': value['preflightSnapshot']['services'][0]['candidate'] = True
            with self.assertRaises(ns['Unproven']): ns['validate'](value)

    def test_missing_optional_is_omitted(self):
        base = base_report()
        self.assertEqual(ns['attach_observation'](copy.deepcopy(base), '/absent-' + CANARY), base)

    def test_valid_optional_is_retained_without_altering_old_fields(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'optional.json'
            path.write_text(json.dumps(result()))
            base = base_report()
            observed = ns['attach_observation'](copy.deepcopy(base), str(path))
            self.assertEqual(observed.pop('topologyObservation'), result())
            self.assertEqual(observed, base)

    def test_unavailable_or_oversize_optional_is_sanitized(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'optional.json'
            for raw in (CANARY, json.dumps({'rawError': CANARY}), CANARY * 10000):
                path.write_text(raw)
                base = base_report()
                observed = ns['attach_observation'](copy.deepcopy(base), str(path))
                self.assertEqual(observed.pop('topologyObservation'), ns['unknown']())
                self.assertEqual(observed, base)

    def test_original_guard_failure_or_contradictory_gate_invalidates_snapshot(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'optional.json'
            path.write_text(json.dumps(result()))
            for kind in ('guard', 'topology'):
                base = base_report()
                base['checks'][0 if kind == 'guard' else 1]['status'] = 'UNEXPECTED'
                observed = ns['attach_observation'](copy.deepcopy(base), str(path))
                self.assertEqual(observed.pop('topologyObservation'), ns['unknown']())
                self.assertEqual(observed, base)

    def test_report_budget_includes_utf8_and_final_newline(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'optional.json'
            path.write_text(json.dumps(result()))
            for length in (62000, 65100, 65400, 66000):
                base = base_report()
                base['padding'] = 'x' * length
                observed = ns['attach_observation'](copy.deepcopy(base), str(path))
                if 'topologyObservation' in observed:
                    self.assertLessEqual(len((json.dumps(observed, ensure_ascii=False, separators=(',', ':')) + '\n').encode()), 65536)
                    observed.pop('topologyObservation')
                self.assertEqual(observed, base)
            base = base_report()
            base['padding'] = '\u0431' * 32500
            observed = ns['attach_observation'](copy.deepcopy(base), str(path))
            if 'topologyObservation' in observed:
                self.assertLessEqual(len((json.dumps(observed, ensure_ascii=False, separators=(',', ':')) + '\n').encode()), 65536)

    def test_exact_report_builder_preserves_captured_five_blockers(self):
        fixture = {'schemaVersion': 'tai.reg-ru.preflight.v1', 'targetSha': '2b3e8c11994d5b0652ef2c3348c13dad893e959e', 'image': {'reference': 'ghcr.io/pachaninm-lab/grainflow-tai:sha-2b3e8c1', 'digest': 'ghcr.io/pachaninm-lab/grainflow-tai@sha256:0717b0fb989ab015533b623c6cf06c442b299db4736600293e9668b1f1b2f658'}, 'generatedAt': '2026-10-01T20:04:56.675608+00:00', 'mode': 'READ_ONLY_PREFLIGHT', 'productionMutationAllowed': False, 'checks': [{'name': 'compose_authority', 'status': 'PASS', 'code': 'COMPOSE_AUTHORITY_READY'}, {'name': 'compose_files', 'status': 'PASS', 'code': 'PROTECTED_COMPOSE_READABLE', 'value': '47'}, {'name': 'topology', 'status': 'BLOCKED', 'code': 'CORE_TOPOLOGY_INCOMPLETE', 'value': '11'}, {'name': 'tai_topology', 'status': 'BLOCKED', 'code': 'TAI_SERVICE_NOT_MATERIALIZED'}, {'name': 'runtime_presence', 'status': 'PASS', 'code': 'API_WEB_RUNTIME_PRESENT'}, {'name': 'live_baseline', 'status': 'PASS', 'code': 'API_WEB_BASELINE_HEALTHY'}, {'name': 'rollback_baseline', 'status': 'PASS', 'code': 'ROLLBACK_BASELINE_IDENTIFIED'}, {'name': 'exact_runtime', 'status': 'BLOCKED', 'code': 'API_WEB_NOT_EXACT_MAIN'}, {'name': 'disk_capacity', 'status': 'PASS', 'code': 'DOCKER_DISK_CAPACITY_READY', 'value': '7717776'}, {'name': 'memory_capacity', 'status': 'PASS', 'code': 'HOST_MEMORY_CAPACITY_READY', 'value': '3318800'}, {'name': 'model_env', 'status': 'PASS', 'code': 'EXISTING_LOCAL_MODEL_ENV_READY'}, {'name': 'model_connectivity', 'status': 'PASS', 'code': 'API_TO_PRIVATE_MODEL_HEALTHY'}, {'name': 'tai_relations', 'status': 'PASS', 'code': 'TAI_RELATIONS_READY', 'value': '16/16'}, {'name': 'knowledge_generation', 'status': 'PASS', 'code': 'ACTIVE_KNOWLEDGE_READY', 'value': '1'}, {'name': 'model_profile', 'status': 'PASS', 'code': 'ACTIVE_MODEL_PROFILE_READY', 'value': '1'}, {'name': 'model_identity', 'status': 'PASS', 'code': 'ACTIVE_MODEL_IDENTITY_MATCHED', 'value': '1/1'}, {'name': 'model_admission', 'status': 'DEFERRED', 'code': 'MODEL_ADMISSION_NOT_ATTESTED', 'value': '0/1'}, {'name': 'tai_environment', 'status': 'BLOCKED', 'code': 'TAI_DEDICATED_ENV_NOT_MATERIALIZED'}, {'name': 'tai_database_principal', 'status': 'BLOCKED', 'code': 'TAI_DEDICATED_DB_PRINCIPAL_NOT_ATTESTED'}, {'name': 'mutation_guard', 'status': 'PASS', 'code': 'NO_PRODUCTION_MUTATION_DETECTED'}], 'maturity': [{'name': 'model_admission', 'status': 'DEFERRED', 'code': 'MODEL_ADMISSION_NOT_ATTESTED', 'value': '0/1'}], 'blockers': ['API_WEB_NOT_EXACT_MAIN', 'CORE_TOPOLOGY_INCOMPLETE', 'TAI_DEDICATED_DB_PRINCIPAL_NOT_ATTESTED', 'TAI_DEDICATED_ENV_NOT_MATERIALIZED', 'TAI_SERVICE_NOT_MATERIALIZED'], 'passed': False}
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'checks.tsv').write_text(''.join('\t'.join([row['name'], row['status'], row['code'], row.get('value', '')]) + '\n' for row in fixture['checks']))
            (root / 'blockers.txt').write_text('\n'.join(fixture['blockers']) + '\n')
            (root / 'topology-observer.py').write_text(observer_source)
            args = [sys.executable, '-c', report_source, fixture['targetSha'], fixture['image']['reference'], fixture['image']['digest'], str(root / 'checks.tsv'), str(root / 'blockers.txt'), str(root)]
            for optional in (None, result(), ns['unknown'](), {'rawError': CANARY}):
                if optional is not None: (root / 'topology-observation.json').write_text(json.dumps(optional))
                process = subprocess.run(args, capture_output=True, check=True, timeout=5)
                report = json.loads(process.stdout)
                if optional is None: self.assertNotIn('topologyObservation', report)
                else: ns['validate'](report.pop('topologyObservation'))
                report['generatedAt'] = fixture['generatedAt']
                self.assertEqual(report, fixture)
            (root / 'topology-observer.py').write_text('raise RuntimeError("' + CANARY + '")')
            process = subprocess.run(args, capture_output=True, check=True, timeout=5)
            report = json.loads(process.stdout)
            self.assertEqual(report.pop('topologyObservation'), ns['unknown']())
            report['generatedAt'] = fixture['generatedAt']
            self.assertEqual(report, fixture)
            # Even an unavailable optional module must not expand a near-limit report.
            (root / 'checks.tsv').write_text('padding\tPASS\tPADDING\t' + 'x' * 65200 + '\n')
            process = subprocess.run(args, capture_output=True, check=True, timeout=5)
            self.assertNotIn('topologyObservation', json.loads(process.stdout))
            self.assertNotIn(CANARY, process.stdout.decode())

    def test_actual_collector_bounds_context_and_snapshot(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            module = root / 'observer.py'
            source = root / 'compose.json'
            module.write_text(observer_source)
            context, model = fixture()
            source.write_text(json.dumps(model))
            raw = ('\0'.join(context) + '\0').encode()
            for supplied in (raw, b'x' * 65537):
                process = subprocess.run([sys.executable, str(module), str(source)], input=supplied, capture_output=True, timeout=5, check=True)
                value = json.loads(process.stdout)
                ns['validate'](value)
                self.assertNotIn(CANARY, process.stdout.decode())
                if supplied == raw: self.assertEqual(value, result())
                else: self.assertEqual(value, ns['unknown']())
            source.write_bytes(b'x' * (ns['MAX_MODEL_BYTES'] + 1))
            process = subprocess.run([sys.executable, str(module), str(source)], input=raw, capture_output=True, timeout=5, check=True)
            self.assertEqual(json.loads(process.stdout), ns['unknown']())


suite = unittest.defaultTestLoader.loadTestsFromTestCase(SnapshotContract)
run = unittest.TextTestRunner(verbosity=1).run(suite)
if not run.wasSuccessful(): raise SystemExit(1)
print('Snapshot-only executable regressions: ' + str(run.testsRun) + ' passed')
`;
  const result = spawnSync('python3', ['-c', observerTests], {input: script, encoding: 'utf8', timeout: 20000, maxBuffer: 1024 * 1024});
  if (result.status !== 0 || result.error) violations.push('executable snapshot-only observation regressions failed');
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}

if(violations.length){console.error('TAI REG.RU preflight contract failed:');for(const v of violations)console.error(`- ${v}`);process.exit(1)}
console.log('TAI REG.RU preflight contract PASS: protected exact-main controller, read-only, override-aware, digest-bound and fail-closed.');
