#!/usr/bin/env node
import fs from 'node:fs';
import {
  validateRegistry,
} from './pc-crop-owned-diff.mjs';

const registryPath = 'docs/platform-v7/autopilot/pc-crop-workflow-ownership.json';
const registry = validateRegistry(JSON.parse(fs.readFileSync(registryPath, 'utf8')));

function yamlQuote(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function replacePathBlock(lines, section, triggerPaths) {
  const sectionIndex = lines.findIndex((line) => line === `  ${section}:`);
  if (sectionIndex < 0) throw new Error(`Missing ${section} section`);
  const pathsIndex = lines.findIndex(
    (line, index) => index > sectionIndex && line === '    paths:',
  );
  if (pathsIndex < 0) throw new Error(`Missing ${section}.paths`);
  let end = pathsIndex + 1;
  while (end < lines.length && lines[end].startsWith('      - ')) end += 1;
  const replacement = [
    '    paths:',
    ...triggerPaths.map((entry) => `      - ${yamlQuote(entry)}`),
  ];
  lines.splice(pathsIndex, end - pathsIndex, ...replacement);
}

function replaceScopeStep(lines, workflowId, stepName) {
  const start = lines.findIndex((line) => line === `      - name: ${stepName}`);
  if (start < 0) {
    const marker = `--workflow ${yamlQuote(workflowId)}`;
    if (lines.some((line) => line.includes(marker))) return;
    throw new Error(`Missing scope step ${stepName}`);
  }
  let end = start + 1;
  while (end < lines.length && !/^      - (?:name|uses):/u.test(lines[end])) end += 1;
  const replacement = [
    `      - name: ${stepName}`,
    '        shell: bash',
    '        run: |',
    '          set -euo pipefail',
    '          mkdir -p "$EVIDENCE_DIR"',
    '          printf \'%s\\n\' "$EXACT_HEAD" > "$EVIDENCE_DIR/exact-head.txt"',
    '          if [[ "${{ github.event_name }}" == \'pull_request\' ]]; then',
    '            git fetch --no-tags origin "${{ github.base_ref }}"',
    '            base_ref="origin/${{ github.base_ref }}"',
    '          else',
    '            base_ref=\'HEAD^\'',
    '          fi',
    '          printf \'%s\\n\' "$base_ref" > "$EVIDENCE_DIR/base-ref.txt"',
    '          node scripts/pc-crop-owned-diff.mjs \\',
    `            --workflow ${yamlQuote(workflowId)} \\`,
    '            --base-ref "$base_ref" \\',
    '            --head-ref "$EXACT_HEAD" \\',
    '            --evidence-dir "$EVIDENCE_DIR"',
    '          touch "$EVIDENCE_DIR/scope-guard.ok"',
    '',
  ];
  lines.splice(start, end - start, ...replacement);
}

const changed = [];
for (const [workflowId, ownership] of Object.entries(registry.workflows)) {
  const file = ownership.workflowPath;
  const original = fs.readFileSync(file, 'utf8');
  const trailingNewline = original.endsWith('\n');
  const lines = original.split(/\r?\n/u);
  if (lines.at(-1) === '') lines.pop();
  replacePathBlock(lines, 'pull_request', ownership.triggerPaths);
  replacePathBlock(lines, 'push', ownership.triggerPaths);
  replaceScopeStep(lines, workflowId, ownership.scopeStepName);
  const updated = `${lines.join('\n')}${trailingNewline ? '\n' : ''}`;
  if (updated !== original) {
    fs.writeFileSync(file, updated);
    changed.push(file);
  }
}
console.log(JSON.stringify({ changed }, null, 2));
