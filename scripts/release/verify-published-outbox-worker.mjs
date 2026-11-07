#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const fail = (code) => { throw new Error(code); };
export function validateInputs(expectedSha, reference) {
  if (!/^[0-9a-f]{40}$/.test(expectedSha ?? '')) fail('WORKER_SHA_INVALID');
  if (!/^ghcr\.io\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\/grainflow-outbox-worker@sha256:[0-9a-f]{64}$/.test(reference ?? '')) fail('WORKER_REFERENCE_INVALID');
}

// Publication evidence only. No health, deployment or production PASS is inferred.
export function verifyPublishedWorker(expectedSha, reference, inspected) {
  validateInputs(expectedSha, reference);
  if (!Array.isArray(inspected) || inspected.length !== 1) fail('WORKER_INSPECTION_INVALID');
  const image = inspected[0];
  if (!image || !Array.isArray(image.RepoDigests) || !image.RepoDigests.includes(reference)) fail('WORKER_REGISTRY_DIGEST_MISMATCH');
  if (image.Config?.Labels?.['org.opencontainers.image.revision'] !== expectedSha) fail('WORKER_REVISION_MISMATCH');
  const user = image.Config?.User;
  // The canonical distroless image uses nonroot. Unknown named users are not evidence.
  if (typeof user !== 'string' || !(user === 'nonroot' || user === 'nonroot:nonroot' || /^[1-9][0-9]*(?::[0-9]+)?$/.test(user))) fail('WORKER_NONROOT_UNPROVEN');
  const cmd = image.Config?.Cmd;
  if (!Array.isArray(cmd) || cmd.length !== 1 || cmd[0] !== 'dist-outbox-worker/outbox-worker.js') fail('WORKER_COMMAND_MISMATCH');
  const entrypoint = image.Config?.Entrypoint;
  if (!Array.isArray(entrypoint) || entrypoint.length !== 1 || entrypoint[0] !== '/nodejs/bin/node') fail('WORKER_ENTRYPOINT_MISMATCH');
  if (image.Config?.WorkingDir !== '/app') fail('WORKER_WORKDIR_MISMATCH');
  const env = image.Config?.Env;
  if (!Array.isArray(env)) fail('WORKER_RUNTIME_CONFIG_INVALID');
  for (const [key, expected] of [['NODE_ENV', 'production'], ['RUNTIME_COMPONENT', 'outbox-worker']]) {
    const values = env.filter((entry) => typeof entry === 'string' && entry.startsWith(`${key}=`));
    if (values.length !== 1 || values[0] !== `${key}=${expected}`) fail('WORKER_RUNTIME_CONFIG_INVALID');
  }
  return Object.freeze({
    schemaVersion: 'pc-crop.outbox-worker-publication.v1',
    classification: 'PUBLISHED_IMAGE_IDENTITY_VERIFIED_NOT_DEPLOYMENT',
    sourceCommit: expectedSha,
    imageReference: reference,
    registryDigest: reference.split('@')[1],
    runtimeUser: user,
  });
}

export function inspectPublishedWorker(expectedSha, reference, run = execFileSync) {
  validateInputs(expectedSha, reference);
  let raw;
  try { raw = run('docker', ['image', 'inspect', reference], { encoding: 'utf8', timeout: 30_000, maxBuffer: 4 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch { fail('WORKER_INSPECTION_UNAVAILABLE'); }
  let inspected;
  try { inspected = JSON.parse(raw); } catch { fail('WORKER_INSPECTION_INVALID'); }
  return verifyPublishedWorker(expectedSha, reference, inspected);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 4) fail('WORKER_ARGUMENTS_INVALID');
    process.stdout.write(`${JSON.stringify(inspectPublishedWorker(process.argv[2], process.argv[3]))}\n`);
  } catch (error) {
    const code = /^WORKER_[A-Z_]+$/.test(error?.message ?? '') ? error.message : 'WORKER_VERIFICATION_FAILED';
    process.stderr.write(`${code}\n`);
    process.exitCode = 1;
  }
}
