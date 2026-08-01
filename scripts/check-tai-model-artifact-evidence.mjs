#!/usr/bin/env node
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const paths = {
  resolver: 'scripts/tai_model_artifact_evidence.py',
  scope: 'docs/platform-v7/autopilot/scopes/tai-reg-ru-model-artifact-evidence-20260801.json',
};

const resolverSource = readFileSync(paths.resolver, 'utf8');
const scope = JSON.parse(readFileSync(paths.scope, 'utf8'));
const violations = [];

const requireFragment = (source, fragment, label) => {
  if (!source.includes(fragment)) violations.push(`${label}: missing ${JSON.stringify(fragment)}`);
};
const forbid = (source, pattern, label) => {
  if (pattern.test(source)) violations.push(label);
};

for (const fragment of [
  'systemctl", "show", SERVICE_NAME, "--property=ControlGroup"',
  'cgroup.procs',
  'process_root / "cmdline"',
  'process_root / "environ"',
  'process_root / "maps"',
  'process_root / "fd"',
  'model artifact authority is ambiguous',
  '"schemaVersion": "tai.restricted-model-artifact.v1"',
  '"modelIdentity": MODEL_IDENTITY',
  '"artifactSha256": _sha256(path)',
]) requireFragment(resolverSource, fragment, paths.resolver);

forbid(
  resolverSource,
  /(?:rglob|glob)\(\s*["'][^"']*[*][^"']*\.gguf/iu,
  `${paths.resolver}: host-wide GGUF discovery is forbidden`,
);
forbid(
  resolverSource,
  /os\.walk|find\s+\/|pathlib\.Path\(\s*["']\/srv/iu,
  `${paths.resolver}: unbounded filesystem discovery is forbidden`,
);

if (scope.schemaVersion !== 'platform-v7.concurrent-scope.v1') {
  violations.push(`${paths.scope}: invalid schemaVersion`);
}
if (scope.branch !== 'fix/tai-reg-ru-model-artifact-evidence-20260801') {
  violations.push(`${paths.scope}: branch mismatch`);
}
if (scope.productionHosting !== 'REG_RU_VPS_ONLY' || scope.newRecurringCostRub !== 0) {
  violations.push(`${paths.scope}: hosting or cost boundary changed`);
}
for (const path of [
  paths.resolver,
  paths.scope,
  'scripts/pc-tai-release-controller-core.sh',
  'scripts/check-pc-tai-release-controller.mjs',
]) {
  if (!scope.allowedPaths.includes(path)) {
    violations.push(`${paths.scope}: ${path} outside allowedPaths`);
  }
}

const runResolver = ({ root, pid = 4242, controlGroup = '/system.slice/tai-qwen3-8b.service' }) => {
  return spawnSync('python3', [paths.resolver], {
    encoding: 'utf8',
    env: {
      ...process.env,
      TAI_MODEL_EVIDENCE_TEST_MODE: '1',
      TAI_MODEL_EVIDENCE_MAIN_PID: String(pid),
      TAI_MODEL_EVIDENCE_CONTROL_GROUP: controlGroup,
      TAI_MODEL_EVIDENCE_PROC_ROOT: join(root, 'proc'),
      TAI_MODEL_EVIDENCE_CGROUP_ROOT: join(root, 'cgroup'),
    },
  });
};

const writeNul = (path, values) => {
  writeFileSync(path, Buffer.from(`${values.join('\0')}\0`, 'utf8'));
};

const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), 'tai-model-evidence-'));
  const pid = 4242;
  const processRoot = join(root, 'proc', String(pid));
  const cgroup = join(root, 'cgroup', 'system.slice', 'tai-qwen3-8b.service');
  const model = join(root, 'models', 'qwen3-8b-q4-k-m.gguf');
  mkdirSync(join(processRoot, 'fd'), { recursive: true });
  mkdirSync(cgroup, { recursive: true });
  mkdirSync(dirname(model), { recursive: true });
  writeFileSync(join(cgroup, 'cgroup.procs'), `${pid}\n`);
  writeFileSync(model, 'deterministic-model-fixture');
  writeNul(join(processRoot, 'cmdline'), ['/usr/bin/bash', '/usr/local/bin/model-wrapper']);
  writeNul(join(processRoot, 'environ'), ['OTHER=1']);
  writeFileSync(join(processRoot, 'maps'), '');
  return { root, pid, processRoot, cgroup, model };
};

if (!violations.length) {
  const roots = [];
  try {
    {
      const current = fixture();
      roots.push(current.root);
      writeNul(join(current.processRoot, 'environ'), [
        `TAI_MODEL_PATH=${current.model}`,
        'CONTEXT_SIZE=4096',
      ]);
      const result = runResolver(current);
      if (result.status !== 0) {
        violations.push(`environment-backed wrapper fixture failed: ${result.stderr.trim()}`);
      } else {
        const payload = JSON.parse(result.stdout);
        const expectedDigest = createHash('sha256')
          .update(readFileSync(current.model))
          .digest('hex');
        if (payload.artifactPath !== resolve(current.model)) {
          violations.push('environment-backed wrapper fixture resolved the wrong model path');
        }
        if (payload.artifactSha256 !== expectedDigest) {
          violations.push('environment-backed wrapper fixture produced the wrong digest');
        }
        if (payload.maximumContextTokens !== 4096) {
          violations.push('environment-backed wrapper fixture lost context authority');
        }
      }
    }

    {
      const current = fixture();
      roots.push(current.root);
      writeFileSync(
        join(current.processRoot, 'maps'),
        `7f000000-7f001000 r--s 00000000 00:00 0 ${current.model}\n`,
      );
      const result = runResolver(current);
      if (result.status !== 0) {
        violations.push(`memory-map fixture failed: ${result.stderr.trim()}`);
      } else if (JSON.parse(result.stdout).artifactPath !== resolve(current.model)) {
        violations.push('memory-map fixture resolved the wrong model path');
      }
    }

    {
      const current = fixture();
      roots.push(current.root);
      symlinkSync(current.model, join(current.processRoot, 'fd', '8'));
      const result = runResolver(current);
      if (result.status !== 0) {
        violations.push(`open-file fixture failed: ${result.stderr.trim()}`);
      } else if (JSON.parse(result.stdout).artifactPath !== resolve(current.model)) {
        violations.push('open-file fixture resolved the wrong model path');
      }
    }

    {
      const current = fixture();
      roots.push(current.root);
      const second = join(current.root, 'models', 'other.gguf');
      writeFileSync(second, 'second-model');
      writeNul(join(current.processRoot, 'environ'), [`TAI_MODEL_PATH=${second}`]);
      writeFileSync(
        join(current.processRoot, 'maps'),
        `7f000000-7f001000 r--s 00000000 00:00 0 ${current.model}\n`,
      );
      const result = runResolver(current);
      if (result.status === 0 || !result.stderr.includes('authority is ambiguous')) {
        violations.push('ambiguous live model evidence did not fail closed');
      }
    }

    {
      const current = fixture();
      roots.push(current.root);
      const result = runResolver({ ...current, controlGroup: '/' });
      if (result.status === 0 || !result.stderr.includes('invalid test ControlGroup')) {
        violations.push('host-root cgroup authority did not fail closed');
      }
    }

    {
      const current = fixture();
      roots.push(current.root);
      const result = runResolver(current);
      if (result.status === 0 || !result.stderr.includes('authority is ambiguous')) {
        violations.push('missing live model evidence did not fail closed');
      }
    }
  } finally {
    for (const root of roots) rmSync(root, { recursive: true, force: true });
  }
}

if (violations.length) {
  console.error('TAI model artifact evidence contract failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(
  'TAI model artifact evidence contract PASS: exact systemd cgroup, wrapper environment, memory-map and open-file resolution; ambiguous or missing authority fails closed.',
);
