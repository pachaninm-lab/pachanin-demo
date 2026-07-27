#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import process from 'node:process';

const APPLY = process.argv.includes('--apply');
const CHECK = process.argv.includes('--check');
if (APPLY === CHECK) {
  throw new Error('use exactly one of --apply or --check');
}

const workflow08dPath = '.github/workflows/pc-crop-08d.yml';
const workflow08fPath = '.github/workflows/pc-crop-08f.yml';
const lockPath = 'docs/platform-v7/autopilot/pc-crop-predecessor-trigger-lock.json';

const scopeStep = ({ slice, scopePath, ownRegex }) => `      - name: Resolve ${slice} exact scope or successor regression\n        shell: bash\n        run: |\n          set -euo pipefail\n          mkdir -p "$EVIDENCE_DIR"\n          printf '%s\\n' "$EXACT_HEAD" > "$EVIDENCE_DIR/exact-head.txt"\n          if [[ "\${{ github.event_name }}" == 'pull_request' ]]; then\n            git fetch --no-tags origin "\${{ github.base_ref }}"\n            base_ref="origin/\${{ github.base_ref }}"\n          else\n            base_ref='HEAD^'\n          fi\n          printf '%s\\n' "$base_ref" > "$EVIDENCE_DIR/base-ref.txt"\n          git diff --name-only "$base_ref...$EXACT_HEAD" | sort > "$EVIDENCE_DIR/changed-files.txt"\n          grep -Ev '${ownRegex}' \\\n            "$EVIDENCE_DIR/changed-files.txt" > "$EVIDENCE_DIR/out-of-scope.txt" || true\n          node scripts/pc-crop-successor-regression-mode.mjs \\\n            --slice ${slice} \\\n            --event-name "\${{ github.event_name }}" \\\n            --head-branch "\${{ github.head_ref || github.ref_name }}" \\\n            --slice-scope ${scopePath} \\\n            --changed-files "$EVIDENCE_DIR/changed-files.txt" \\\n            --out-of-scope "$EVIDENCE_DIR/out-of-scope.txt" \\\n            --evidence-dir "$EVIDENCE_DIR"\n          touch "$EVIDENCE_DIR/scope-guard.ok"\n`;

const regex08d = '^(\\.github/workflows/pc-crop-08[bcd]\\.yml|apps/api/src/outbox-worker\\.module\\.ts|apps/api/src/modules/integration-events/durable-outbox\\.worker(\\.spec)?\\.ts|apps/api/src/modules/regulatory-integration/fgis-grain/.*|apps/api/src/modules/regulatory-integration/regulatory-integration\\.module\\.ts|apps/api/test/industrial/(fgis-grain-dispatch|outbox-worker-process)\\.e2e-spec\\.ts|docs/platform-v7/autopilot/scopes/pc-crop-08d-fgis-signing-transport\\.json|docs/platform-v7/crop-platform/fgis-grain-api-1\\.0\\.23\\.signing-policy(\\.lock)?\\.json|infra/sql/postgresql-fgis-grain-dispatch-policies\\.sql|scripts/pc-crop-08d/.*|scripts/p7-autopilot-guard\\.sh)$';
const regex08f = '^(\\.github/workflows/pc-crop-08f\\.yml|apps/api/prisma/schema\\.prisma|apps/api/prisma/migrations/20260724190000_fgis_grain_sdiz_projection/.*|apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-sdiz-.*\\.ts|apps/api/src/modules/regulatory-integration/regulatory-integration\\.module\\.ts|apps/api/test/industrial/fgis-grain-sdiz-projection\\.e2e-spec\\.ts|docs/platform-v7/autopilot/scopes/pc-crop-08f-sdiz-projection\\.json|scripts/pc-crop-08f/.*)$';

function replaceScopeStep(source, slice, replacement) {
  if (source.includes(`- name: Resolve ${slice} exact scope or successor regression`)) {
    return source;
  }
  const expression = new RegExp(
    `      - name: Enforce exact ${slice} scope\\n[\\s\\S]*?          touch "\\$EVIDENCE_DIR/scope-guard\\.ok"\\n`,
    'u',
  );
  if (!expression.test(source)) {
    throw new Error(`unable to locate ${slice} scope step`);
  }
  return source.replace(expression, replacement);
}

function addEvidenceModeCheck(source, slice) {
  if (source.includes(`modeEvidence.slice !== '${slice}'`)) return source;
  const anchor = `          if (report.slice !== '${slice}'`;
  const lineStart = source.indexOf(anchor);
  if (lineStart < 0) throw new Error(`unable to locate ${slice} report identity check`);
  const lineEnd = source.indexOf('\n', lineStart);
  const insertion = `\n          const modeEvidence = JSON.parse(fs.readFileSync(\`\${process.env.EVIDENCE_DIR}/acceptance-mode.json\`, 'utf8'));\n          if (modeEvidence.schemaVersion !== 'pc-crop.successor-regression-mode.v1') process.exit(1);\n          if (modeEvidence.slice !== '${slice}' || modeEvidence.mode !== report.acceptanceMode) process.exit(1);\n          if (!['EXACT_SCOPE', 'SUCCESSOR_REGRESSION'].includes(report.acceptanceMode)) process.exit(1);`;
  return `${source.slice(0, lineEnd)}${insertion}${source.slice(lineEnd)}`;
}

function normalizeWorkflow(source, { slice, scopePath, ownRegex }) {
  let next = replaceScopeStep(source, slice, scopeStep({ slice, scopePath, ownRegex }));
  next = addEvidenceModeCheck(next, slice);
  return next;
}

function jobsTailHash(source) {
  const marker = '\njobs:';
  const index = source.indexOf(marker);
  if (index < 0) throw new Error('workflow has no jobs section');
  return crypto.createHash('sha256').update(source.slice(index + 1), 'utf8').digest('hex');
}

const original08d = fs.readFileSync(workflow08dPath, 'utf8');
const original08f = fs.readFileSync(workflow08fPath, 'utf8');
const next08d = normalizeWorkflow(original08d, {
  slice: 'PC-CROP-08D',
  scopePath: 'docs/platform-v7/autopilot/scopes/pc-crop-08d-fgis-signing-transport.json',
  ownRegex: regex08d,
});
const next08f = normalizeWorkflow(original08f, {
  slice: 'PC-CROP-08F',
  scopePath: 'docs/platform-v7/autopilot/scopes/pc-crop-08f-sdiz-projection.json',
  ownRegex: regex08f,
});

const originalLock = fs.readFileSync(lockPath, 'utf8');
const lock = JSON.parse(originalLock);
lock.baselineCommit = '1af525d5ce0cc6663a510f788ab9ee3a36ff9c65';
lock.decisionIssue = 3291;
lock.acceptanceModeContract = 'pc-crop.successor-regression-mode.v1';
lock.workflows['.github/workflows/pc-crop-08d.yml'].jobsTailSha256 = jobsTailHash(next08d);
const nextLock = `${JSON.stringify(lock, null, 2)}\n`;

const changes = [
  [workflow08dPath, original08d, next08d],
  [workflow08fPath, original08f, next08f],
  [lockPath, originalLock, nextLock],
].filter(([, before, after]) => before !== after);

if (CHECK && changes.length > 0) {
  for (const [filePath] of changes) process.stderr.write(`normalization required: ${filePath}\n`);
  process.exit(1);
}
if (APPLY) {
  for (const [filePath, , after] of changes) fs.writeFileSync(filePath, after, 'utf8');
}
process.stdout.write(`${JSON.stringify({ mode: APPLY ? 'apply' : 'check', changed: changes.map(([filePath]) => filePath) })}\n`);
