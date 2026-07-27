import fs from 'node:fs';
import path from 'node:path';

// Every blocking PostgreSQL acceptance job used to pull from Docker Hub anonymously.
// Anonymous pulls are rate limited and intermittently unreachable, and when the pull
// fails the service container never starts: the job dies before its first assertion,
// so the failure is indistinguishable from a failed acceptance.
//
// Consumers now pull a digest under repository control. This check refuses any return
// to an unpinned or third-party PostgreSQL image. There is deliberately no fallback to
// Docker Hub: a fallback would hide the dependency again, and the next outage would be
// silent.

const MANIFEST_DIR = '.github/container-images';
const MIRROR_REPOSITORY = 'ghcr.io/pachaninm-lab/ci-postgres';

// Runtime surfaces only. Historical records describe what was true when written and
// must not be rewritten to satisfy a present-day rule.
const SCANNED = [
  { dir: '.github/workflows', extensions: ['.yml', '.yaml'] },
  { dir: 'infra/kind', extensions: ['.yaml', '.yml'] },
  { dir: 'scripts', extensions: ['.sh', '.mjs'] },
];

// Local development compose is not a CI acceptance path and gates no merge.
const EXCLUDED_FILES = new Set([
  'docker-compose.yml',
  'infra/flagsmith/docker-compose-override.yml',
  // The mirror workflow and this checker must name the upstream image: one copies it,
  // the other forbids it. Excluding them is not a hole — their whole subject is the rule.
  '.github/workflows/ci-postgres-image-mirror.yml',
  'scripts/check-ci-postgres-image-authority.mjs',
  'scripts/check-ci-postgres-image-authority.test.mjs',
]);

// Four workflows could not be migrated. Each is named with the image it must keep
// and the control that blocks it, because an unmigrated consumer that is not written
// down is indistinguishable from one nobody checked.
//
// Three are frozen by docs/platform-v7/autopilot/pc-crop-predecessor-trigger-lock.json,
// which pins a sha256 of their `permissions`/`jobs` body against baseline 3133779b1.
// Regenerating that lock so it accepts our own edit would be self-issuing an exemption
// from an immutability control.
//
// The fourth is blocked by a deadlock between two governance systems, not by a lock:
// scripts/p7-autopilot-guard.sh requires every branch to register its scope in
// docs/platform-v7/autopilot/autopilot-state.json, while scripts/verify-pc-crop-01b1.mjs
// refuses any diff containing a file outside its seven-path allowlist — which does not
// include that registry. Any compliant migration PR would therefore have to break one
// of the two, so none is possible without weakening a control.
//
// The exception is bounded, not a hole: a listed workflow may keep exactly the image it
// is recorded with and nothing else, and a test pins the list. Unblocking is an owner
// decision, tracked in docs/platform-v7/autopilot/OWNER_ACTIONS_FINAL.md.
export const BLOCKED_CONSUMERS = new Map([
  ['.github/workflows/pc-crop-07a.yml', { image: 'postgres:16', blockedBy: 'PREDECESSOR_TRIGGER_LOCK' }],
  ['.github/workflows/pc-crop-07b.yml', { image: 'postgres:16', blockedBy: 'PREDECESSOR_TRIGGER_LOCK' }],
  ['.github/workflows/pc-crop-08d.yml', { image: 'postgres:16', blockedBy: 'PREDECESSOR_TRIGGER_LOCK' }],
  ['.github/workflows/pc-crop-01b1.yml', { image: 'postgres:16', blockedBy: 'SLICE_ALLOWLIST_EXCLUDES_SCOPE_REGISTRY' }],
]);

const DIGEST = /^sha256:[0-9a-f]{64}$/;

export function loadManifests(manifestDir = MANIFEST_DIR) {
  const manifests = [];
  for (const entry of fs.readdirSync(manifestDir).sort()) {
    if (!entry.startsWith('postgres-') || !entry.endsWith('.v1.json')) continue;
    const manifest = JSON.parse(fs.readFileSync(path.join(manifestDir, entry), 'utf8'));
    manifests.push({ file: path.join(manifestDir, entry), manifest });
  }
  return manifests;
}

export function checkManifests(manifests) {
  const failures = [];
  if (manifests.length === 0) failures.push(`${MANIFEST_DIR}: no pinned image manifest found`);

  for (const { file, manifest } of manifests) {
    const digest = manifest.mirrored_digest;
    if (!digest) {
      failures.push(`${file}: mirrored_digest is empty`);
    } else if (!DIGEST.test(digest)) {
      failures.push(`${file}: mirrored_digest ${JSON.stringify(digest)} is not a sha256 digest`);
    }
    if (manifest.mirrored_repository !== MIRROR_REPOSITORY) {
      failures.push(
        `${file}: mirrored_repository must be ${MIRROR_REPOSITORY}, found ${JSON.stringify(manifest.mirrored_repository)}`,
      );
    }
    // A mirror that does not reproduce the upstream digest is not a faithful copy,
    // and must not be consumed as if it were the official image.
    if (digest && manifest.upstream_digest !== digest) {
      failures.push(`${file}: mirrored_digest does not equal upstream_digest`);
    }
    if (manifest.verification_status !== 'VERIFIED') {
      failures.push(
        `${file}: verification_status must be VERIFIED before consumers pull it, found ${JSON.stringify(manifest.verification_status)}`,
      );
    }
    if (!manifest.source_run_id) {
      failures.push(`${file}: VERIFIED requires the run that proved it`);
    }
  }
  return failures;
}

function* walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

export function collectScannedFiles(scanned = SCANNED, excluded = EXCLUDED_FILES) {
  const files = [];
  for (const { dir, extensions } of scanned) {
    for (const file of walk(dir)) {
      if (!extensions.includes(path.extname(file))) continue;
      if (excluded.has(file)) continue;
      files.push(file);
    }
  }
  return files.sort();
}

export function checkText(file, text, allowedReferences, blocked = BLOCKED_CONSUMERS) {
  const failures = [];
  const lines = text.split('\n');
  const blockedEntry = blocked.get(file);

  lines.forEach((line, index) => {
    const where = `${file}:${index + 1}`;

    // Any PostgreSQL image reference that is not one of the approved digests.
    const references = line.matchAll(
      /(?:image:\s*|--image=|docker\s+pull\s+)("?)([A-Za-z0-9._\/-]*postgres[A-Za-z0-9._\/-]*(?:[:@][A-Za-z0-9._:-]+)?)\1/g,
    );
    for (const match of references) {
      const reference = match[2];
      if (allowedReferences.has(reference)) continue;

      // A blocked workflow keeps exactly the image it is recorded with. Any other
      // value means it moved anyway, and the exception must not cover that.
      if (blockedEntry !== undefined) {
        if (reference !== blockedEntry.image) {
          failures.push(
            `${where}: ${JSON.stringify(reference)} is not the image this blocked workflow is recorded with (${JSON.stringify(blockedEntry.image)}, blocked by ${blockedEntry.blockedBy})`,
          );
        }
        continue;
      }

      // The repository and the pin are two separate questions, and conflating them
      // misreports the common mistake: `<mirror>:16` *is* the repository mirror, it is
      // simply pinned by a tag that can move under us. Saying "not the mirror" would
      // send the reader looking for the wrong problem.
      const isMirrorRepository =
        reference === MIRROR_REPOSITORY || reference.startsWith(`${MIRROR_REPOSITORY}@`) || reference.startsWith(`${MIRROR_REPOSITORY}:`);

      if (!isMirrorRepository) {
        failures.push(`${where}: PostgreSQL image ${JSON.stringify(reference)} is not the repository mirror`);
      } else if (!reference.startsWith(`${MIRROR_REPOSITORY}@`)) {
        failures.push(`${where}: ${JSON.stringify(reference)} is the mirror but is pinned by a mutable tag, not a digest`);
      } else {
        failures.push(`${where}: ${JSON.stringify(reference)} does not match any verified manifest digest`);
      }
    }

    if (/docker\.io\/library\/postgres/.test(line) || /registry-1\.docker\.io/.test(line)) {
      failures.push(`${where}: direct Docker Hub PostgreSQL reference`);
    }
  });

  return failures;
}

export function runCheck({ manifestDir = MANIFEST_DIR, scanned = SCANNED, excluded = EXCLUDED_FILES } = {}) {
  const manifests = loadManifests(manifestDir);
  const failures = checkManifests(manifests);

  const allowedReferences = new Set();
  for (const { manifest } of manifests) {
    if (manifest.mirrored_digest && manifest.mirrored_repository) {
      allowedReferences.add(`${manifest.mirrored_repository}@${manifest.mirrored_digest}`);
    }
  }

  // A broken manifest set must not be used to bless consumers: without a trustworthy
  // allowlist, every consumer would either pass vacuously or fail for the wrong reason.
  if (failures.length > 0) return failures;

  for (const file of collectScannedFiles(scanned, excluded)) {
    failures.push(...checkText(file, fs.readFileSync(file, 'utf8'), allowedReferences));
  }
  return failures;
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);

if (invokedDirectly) {
  const failures = runCheck();
  if (failures.length > 0) {
    console.error('CI PostgreSQL image authority check failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  // Saying "no Docker Hub pull remains" would be false while the blocked list is
  // non-empty, and a check that overstates its own result is worse than no check.
  const blocked = BLOCKED_CONSUMERS.size;
  console.log(
    blocked === 0
      ? 'PASS: every PostgreSQL consumer pulls a verified digest from the repository mirror; no Docker Hub pull and no mutable tag remains.'
      : `PASS: every migratable PostgreSQL consumer pulls a verified digest from the repository mirror. ${blocked} consumer(s) remain on Docker Hub, each blocked by a named control and recorded in OWNER_ACTIONS_FINAL.md:\n${[...BLOCKED_CONSUMERS].map(([f, e]) => `  - ${f} (${e.image}, blocked by ${e.blockedBy})`).join('\n')}`,
  );
}
