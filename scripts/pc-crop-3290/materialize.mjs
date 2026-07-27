import { readFileSync, rmSync, writeFileSync } from 'node:fs';

function read(file) {
  return readFileSync(file, 'utf8');
}

function write(file, content) {
  writeFileSync(file, content, 'utf8');
}

function replaceExact(content, needle, replacement, expected, label) {
  const count = content.split(needle).length - 1;
  if (count !== expected) {
    throw new Error(`${label}: expected ${expected} occurrences, found ${count}`);
  }
  return content.replaceAll(needle, replacement);
}

function removeYamlPath(content, path) {
  return replaceExact(
    content,
    `      - '${path}'\n`,
    '',
    2,
    `remove YAML trigger ${path}`,
  );
}

function removeJsPath(content, path) {
  return replaceExact(
    content,
    `    '${path}',\n`,
    '',
    1,
    `remove canonical predecessor path ${path}`,
  );
}

const dispatchShared = [
  'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-outbox-dispatch.handler.spec.ts',
  'apps/api/src/modules/regulatory-integration/fgis-grain/fgis-grain-outbox-dispatch.handler.ts',
  'apps/api/test/industrial/fgis-grain-dispatch.e2e-spec.ts',
];
const projectionShared = [
  'apps/api/prisma/schema.prisma',
  'apps/api/src/modules/regulatory-integration/regulatory-integration.module.ts',
];

const workflow08d = '.github/workflows/pc-crop-08d.yml';
let content08d = read(workflow08d);
for (const path of dispatchShared) {
  content08d = removeYamlPath(content08d, path);
}
write(workflow08d, content08d);

const workflow08f = '.github/workflows/pc-crop-08f.yml';
let content08f = read(workflow08f);
for (const path of projectionShared) {
  content08f = removeYamlPath(content08f, path);
}
write(workflow08f, content08f);

const predecessorPath = 'scripts/pc-crop-predecessor-trigger-governance.mjs';
let predecessor = read(predecessorPath);
for (const path of dispatchShared) {
  predecessor = removeJsPath(predecessor, path);
}
write(predecessorPath, predecessor);

rmSync('scripts/pc-crop-3290', { recursive: true, force: true });
rmSync('.github/workflows/pc-crop-3290-materialize.yml', { force: true });
