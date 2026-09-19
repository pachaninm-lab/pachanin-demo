#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  RELEASE_KIND,
  RELEASE_SCHEMA_VERSION,
  identityOf,
  validateRelease,
} from './immutable-release-lib.mjs';

function argsOf(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined) throw new Error(`Invalid argument sequence near ${key ?? '<end>'}`);
    args.set(key.slice(2), value);
  }
  return args;
}

function required(args, name) {
  const value = args.get(name)?.trim();
  if (!value) throw new Error(`--${name} is required`);
  return value;
}

const args = argsOf(process.argv.slice(2));
const sourceCommit = required(args, 'source-commit');
const createdAt = required(args, 'created-at');
const migrationSetDigest = required(args, 'migration-set-digest');
const output = required(args, 'output');

const repositories = {
  api: args.get('api-repository') ?? 'cr.yandex/grainflow/api',
  web: args.get('web-repository') ?? 'cr.yandex/grainflow/web',
  outboxWorker: args.get('worker-repository') ?? 'cr.yandex/grainflow/outbox-worker',
  migration: args.get('migration-repository') ?? 'cr.yandex/grainflow/migrations',
};

const digests = {
  api: required(args, 'api-digest'),
  web: required(args, 'web-digest'),
  outboxWorker: required(args, 'worker-digest'),
  migration: required(args, 'migration-digest'),
};

const payload = {
  kind: RELEASE_KIND,
  schemaVersion: RELEASE_SCHEMA_VERSION,
  repository: 'pachaninm-lab/pachanin-demo',
  sourceCommit,
  createdAt,
  migrationSetDigest,
  build: {
    buildOnce: true,
    deployMany: true,
    commands: [
      'docker build -f infra/docker/Dockerfile.api --build-arg GIT_COMMIT=$SOURCE_COMMIT .',
      'docker build -f infra/docker/Dockerfile.web --build-arg GIT_COMMIT=$SOURCE_COMMIT .',
      'docker build -f infra/docker/Dockerfile.outbox-worker --build-arg GIT_COMMIT=$SOURCE_COMMIT .',
      'docker build -f infra/docker/Dockerfile.migrations --build-arg GIT_COMMIT=$SOURCE_COMMIT .',
    ],
  },
  components: Object.fromEntries(
    Object.keys(repositories).map((name) => [name, {
      repository: repositories[name],
      digest: digests[name],
      sourceCommit,
      runtimeUser: 'nonroot',
    }]),
  ),
  maturityBoundary: 'Immutable build and render evidence only; artifacts are not deployed and no production operation is claimed.',
};

const document = { ...payload, manifestId: identityOf(payload) };
const result = validateRelease(document);
if (!result.valid) throw new Error(`Generated release manifest is invalid: ${result.errors.join('; ')}`);

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
process.stdout.write(`${document.manifestId}\n`);
