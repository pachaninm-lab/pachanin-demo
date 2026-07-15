#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { readJson, releaseTarget } from './immutable-release-lib.mjs';

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

function quote(value) {
  return JSON.stringify(value);
}

const environments = {
  staging: {
    namespace: 'grainflow-staging',
    apiHost: 'api.staging.grainflow.invalid',
    webHost: 'app.staging.grainflow.invalid',
  },
  'production-like': {
    namespace: 'grainflow-acceptance',
    apiHost: 'api.acceptance.grainflow.invalid',
    webHost: 'app.acceptance.grainflow.invalid',
  },
  production: {
    namespace: 'grainflow-prod',
    apiHost: 'api.grainflow.ru',
    webHost: 'app.grainflow.ru',
  },
};

const args = argsOf(process.argv.slice(2));
const document = await readJson(required(args, 'document'));
const environment = required(args, 'environment');
const output = required(args, 'output');
const configuration = environments[environment];
if (!configuration) throw new Error(`Unsupported environment ${environment}; expected ${Object.keys(environments).join(', ')}`);

const target = releaseTarget(document);
const values = `# Generated from immutable release authority. Do not edit manually.
release:
  sourceCommit: ${quote(target.sourceCommit)}
  manifestId: ${quote(target.manifestId)}
  migrationSetDigest: ${quote(target.migrationSetDigest)}

migration:
  enabled: true
  image:
    repository: ${quote(target.components.migration.repository)}
    digest: ${quote(target.components.migration.digest)}

api:
  enabled: true
  image:
    repository: ${quote(target.components.api.repository)}
    digest: ${quote(target.components.api.digest)}
  ingress:
    hosts:
      - host: ${quote(configuration.apiHost)}
        paths:
          - path: /
            pathType: Prefix

web:
  enabled: true
  image:
    repository: ${quote(target.components.web.repository)}
    digest: ${quote(target.components.web.digest)}
  ingress:
    hosts:
      - host: ${quote(configuration.webHost)}

outboxWorker:
  enabled: true
  image:
    repository: ${quote(target.components.outboxWorker.repository)}
    digest: ${quote(target.components.outboxWorker.digest)}

namespace:
  create: true
  name: ${quote(configuration.namespace)}
  labels:
    environment: ${quote(environment)}
    team: grainflow
`;

await mkdir(dirname(output), { recursive: true });
await writeFile(output, values, 'utf8');
process.stdout.write(`${output}\n`);
