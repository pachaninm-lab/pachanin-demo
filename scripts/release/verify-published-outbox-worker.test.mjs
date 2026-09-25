import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyPublishedWorker, inspectPublishedWorker } from './verify-published-outbox-worker.mjs';
const sha = 'a'.repeat(40);
const digest = `sha256:${'b'.repeat(64)}`;
const ref = `ghcr.io/pachaninm-lab/grainflow-outbox-worker@${digest}`;
const fixture = () => [{ Id: `sha256:${'c'.repeat(64)}`, RepoDigests: [ref], Config: {
  User: 'nonroot', Labels: { 'org.opencontainers.image.revision': sha },
  Cmd: ['dist-outbox-worker/outbox-worker.js'],
  Entrypoint: ['/nodejs/bin/node'], WorkingDir: '/app',
  Env: ['NODE_ENV=production', 'RUNTIME_COMPONENT=outbox-worker', 'SECRET=SYNTHETIC_SECRET_CANARY'],
} }];

test('accepts registry digest and full OCI revision, without leaking configuration or implying deployment', () => {
  const result = verifyPublishedWorker(sha, ref, fixture());
  assert.equal(result.registryDigest, digest);
  assert.equal(result.classification, 'PUBLISHED_IMAGE_IDENTITY_VERIFIED_NOT_DEPLOYMENT');
  assert.doesNotMatch(JSON.stringify(result), /SYNTHETIC_SECRET_CANARY|Config|sha256:c/);
});
for (const [name, mutate, error] of [
  ['stale revision', x => { x[0].Config.Labels['org.opencontainers.image.revision'] = 'd'.repeat(40); }, 'WORKER_REVISION_MISMATCH'],
  ['missing label', x => { delete x[0].Config.Labels; }, 'WORKER_REVISION_MISMATCH'],
  ['config ID substituted for registry digest', x => { x[0].RepoDigests = [`ghcr.io/pachaninm-lab/grainflow-outbox-worker@${x[0].Id}`]; }, 'WORKER_REGISTRY_DIGEST_MISMATCH'],
  ['missing digest', x => { delete x[0].RepoDigests; }, 'WORKER_REGISTRY_DIGEST_MISMATCH'],
  ['API command', x => { x[0].Config.Cmd = ['dist/main.js']; }, 'WORKER_COMMAND_MISMATCH'],
  ['missing entrypoint', x => { delete x[0].Config.Entrypoint; }, 'WORKER_ENTRYPOINT_MISMATCH'],
  ['empty entrypoint', x => { x[0].Config.Entrypoint = []; }, 'WORKER_ENTRYPOINT_MISMATCH'],
  ['shell entrypoint', x => { x[0].Config.Entrypoint = ['/bin/sh', '-c']; }, 'WORKER_ENTRYPOINT_MISMATCH'],
  ['entrypoint bypassing worker', x => { x[0].Config.Entrypoint = ['/nodejs/bin/node', '-e', 'process.exit(0)']; }, 'WORKER_ENTRYPOINT_MISMATCH'],
  ['string entrypoint', x => { x[0].Config.Entrypoint = '/nodejs/bin/node'; }, 'WORKER_ENTRYPOINT_MISMATCH'],
  ['missing workdir', x => { delete x[0].Config.WorkingDir; }, 'WORKER_WORKDIR_MISMATCH'],
  ['wrong workdir', x => { x[0].Config.WorkingDir = '/tmp'; }, 'WORKER_WORKDIR_MISMATCH'],
  ['wrong runtime', x => { x[0].Config.Env = ['NODE_ENV=production','RUNTIME_COMPONENT=api']; }, 'WORKER_RUNTIME_CONFIG_INVALID'],
  ['ambiguous runtime', x => { x[0].Config.Env.push('RUNTIME_COMPONENT=api'); }, 'WORKER_RUNTIME_CONFIG_INVALID'],
  ['empty inspection', x => { x.length = 0; }, 'WORKER_INSPECTION_INVALID'],
  ['ambiguous inspection', x => { x.push(x[0]); }, 'WORKER_INSPECTION_INVALID'],
]) test(`rejects ${name}`, () => { const x = fixture(); mutate(x); assert.throws(() => verifyPublishedWorker(sha, ref, x), { message: error }); });
for (const user of ['', '0', '0:1000', 'root', 'root:root', 'unknown', '00']) {
  test(`rejects unproven non-root identity ${JSON.stringify(user)}`, () => {
    const x = fixture(); x[0].Config.User = user;
    assert.throws(() => verifyPublishedWorker(sha, ref, x), { message: 'WORKER_NONROOT_UNPROVEN' });
  });
}
for (const reference of ['latest', ref.replace('@', ':'), ref.replace('grainflow-outbox-worker', 'grainflow-api'), ref.replace('ghcr.io', 'example.invalid')]) {
  test(`rejects invalid reference ${reference}`, () => {
    let called = false;
    assert.throws(() => inspectPublishedWorker(sha, reference, () => { called = true; }), { message: 'WORKER_REFERENCE_INVALID' });
    assert.equal(called, false);
  });
}
test('rejects non-canonical SHA before invoking Docker', () => {
  assert.throws(() => inspectPublishedWorker(sha.toUpperCase(), ref, () => assert.fail('must not run')), { message: 'WORKER_SHA_INVALID' });
});
test('uses exact digest in Docker inspect, never shell interpolation', () => {
  const result = inspectPublishedWorker(sha, ref, (cmd, args, opts) => {
    assert.equal(cmd, 'docker'); assert.deepEqual(args, ['image', 'inspect', ref]); assert.equal(opts.timeout, 30_000);
    return JSON.stringify(fixture());
  });
  assert.equal(result.sourceCommit, sha);
});
test('transport failure is sanitized and cannot become publication evidence', () => {
  assert.throws(() => inspectPublishedWorker(sha, ref, () => { throw new Error('SYNTHETIC_SECRET_CANARY'); }), { message: 'WORKER_INSPECTION_UNAVAILABLE' });
});
test('malformed Docker output fails closed', () => {
  assert.throws(() => inspectPublishedWorker(sha, ref, () => '{'), { message: 'WORKER_INSPECTION_INVALID' });
});
