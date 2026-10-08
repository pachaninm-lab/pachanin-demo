import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('internal classification requires exact SrcFile manifest evidence', () => {
  const root = mkdtempSync(join(tmpdir(), 'pc-license-map-'));
  const sbomDir = join(root, 'sbom');
  const outDir = join(root, 'out');
  const overridesPath = join(root, 'overrides.json');
  mkdirSync(sbomDir);
  mkdirSync(outDir);
  writeFileSync(overridesPath, '{"schemaVersion":1,"overrides":[]}\n');
  writeFileSync(join(sbomDir, 'sbom-node.cdx.json'), JSON.stringify({
    bomFormat: 'CycloneDX',
    components: [
      { name: '@pc/untrusted-prefix', version: '1.0.0', purl: 'pkg:npm/%40pc/untrusted-prefix@1.0.0', licenses: [] },
      { name: 'transparent-agro-intelligence', version: '0.1.0', purl: 'pkg:pypi/transparent-agro-intelligence@0.1.0', licenses: [] },
      {
        name: 'transparent-agro-intelligence',
        version: '0.1.0',
        purl: 'pkg:pypi/transparent-agro-intelligence@0.1.0',
        licenses: [],
        properties: [{ name: 'SrcFile', value: 'apps/tai/pyproject.toml' }],
      },
      { name: 'permissive-example', version: '1.0.0', purl: 'pkg:npm/permissive-example@1.0.0', licenses: [{ expression: 'MIT AND Zlib' }] },
    ],
  }));

  execFileSync(process.execPath, [
    'scripts/ip/build-license-map.mjs', sbomDir, outDir, overridesPath,
  ], { cwd: process.cwd(), stdio: 'pipe' });

  const summary = JSON.parse(readFileSync(join(outDir, 'license-summary.json'), 'utf8'));
  assert.equal(summary.components, 4);
  assert.equal(summary.internalComponents, 1);
  assert.equal(summary.classifications.INTERNAL_PROPRIETARY, 1);
  assert.equal(summary.classifications.UNKNOWN_REVIEW, 2);
  assert.equal(summary.classifications.PERMISSIVE_OR_APPROVED, 1);

  const rows = readFileSync(join(outDir, 'license-map.csv'), 'utf8').split('\n');
  const prefixed = rows.find((row) => row.startsWith('@pc/untrusted-prefix,'));
  assert.match(prefixed ?? '', /,UNKNOWN_REVIEW,/u);
  const taiRows = rows.filter((row) => row.startsWith('transparent-agro-intelligence,'));
  assert.equal(taiRows.length, 2);
  assert.equal(taiRows.filter((row) => row.includes(',INTERNAL_PROPRIETARY,')).length, 1);
  assert.equal(taiRows.filter((row) => row.includes(',UNKNOWN_REVIEW,')).length, 1);
});

/**
 * cdxgen оставляет `licenses: null` у части компонентов — на рабочем дереве у
 * 266 из 1193, включая next, react-dom, recharts, zustand и все пакеты со
 * скоупом. Из-за этого 116 из 152 ПОСТАВЛЯЕМЫХ компонентов значились
 * UNKNOWN_REVIEW, хотя их лицензии объявлены в манифестах тех самых пакетов,
 * которые и уезжают в сборку. Ложный UNKNOWN обесценивает карту целиком.
 *
 * Правило разрешения проверяется здесь целиком, включая отказы: версия обязана
 * совпасть, имя пакета само по себе ничего не доказывает, а неразрешённое
 * остаётся UNKNOWN, а не превращается в догадку.
 */
test('a license the SBOM omits is read from the installed artifact, never guessed', () => {
  const root = mkdtempSync(join(tmpdir(), 'pc-license-installed-'));
  const sbomDir = join(root, 'sbom');
  const outDir = join(root, 'out');
  const overridesPath = join(root, 'overrides.json');
  mkdirSync(sbomDir);
  mkdirSync(outDir);
  writeFileSync(overridesPath, '{"schemaVersion":1,"overrides":[]}\n');

  // Склад pnpm: <экранированное имя>@<версия>[_<peer-суффикс>].
  const store = join(root, 'node_modules', '.pnpm');
  const place = (dir, name, manifest) => {
    const target = join(store, dir, 'node_modules', name);
    mkdirSync(target, { recursive: true });
    writeFileSync(join(target, 'package.json'), JSON.stringify(manifest));
  };
  place('plain-pkg@1.2.3_react@18.0.0', 'plain-pkg', { name: 'plain-pkg', version: '1.2.3', license: 'MIT' });
  place('@scope+pkg@2.0.0', '@scope/pkg', { name: '@scope/pkg', version: '2.0.0', license: 'Apache-2.0' });
  place('legacy-pkg@3.0.0', 'legacy-pkg', { name: 'legacy-pkg', version: '3.0.0', licenses: [{ type: 'ISC' }] });
  // Каталог склада совпадает с искомым ключом, а манифест внутри объявляет
  // ДРУГУЮ версию. Только сверка версии это и ловит: без неё лицензия чужого
  // артефакта записалась бы как своя. Прогон мутаций показал, что прежний
  // фикстур до этой проверки не доходил — пакет отсеивался ещё на индексе.
  place('wrong-version@1.0.0', 'wrong-version', { name: 'wrong-version', version: '2.0.0', license: 'MIT' });
  place('copyleft-pkg@1.0.0', 'copyleft-pkg', { name: 'copyleft-pkg', version: '1.0.0', license: 'AGPL-3.0-only' });

  writeFileSync(join(sbomDir, 'sbom-node.cdx.json'), JSON.stringify({
    bomFormat: 'CycloneDX',
    components: [
      { name: 'plain-pkg', version: '1.2.3', purl: 'pkg:npm/plain-pkg@1.2.3', licenses: null },
      { name: 'pkg', group: '@scope', version: '2.0.0', purl: 'pkg:npm/%40scope/pkg@2.0.0', licenses: null },
      { name: 'legacy-pkg', version: '3.0.0', purl: 'pkg:npm/legacy-pkg@3.0.0', licenses: [] },
      // Установлена 9.9.9, а в SBOM 1.0.0 — это другой артефакт, брать нельзя.
      { name: 'wrong-version', version: '1.0.0', purl: 'pkg:npm/wrong-version@1.0.0', licenses: null },
      // На диске отсутствует: остаётся неизвестным, а не угадывается по имени.
      { name: 'absent-pkg', version: '1.0.0', purl: 'pkg:npm/absent-pkg@1.0.0', licenses: null },
      // Разрешение с диска не смягчает политику: копилефт остаётся блокирующим.
      { name: 'copyleft-pkg', version: '1.0.0', purl: 'pkg:npm/copyleft-pkg@1.0.0', licenses: null },
    ],
  }));

  const script = join(process.cwd(), 'scripts/ip/build-license-map.mjs');
  try {
    execFileSync(process.execPath, [script, sbomDir, outDir, overridesPath], { cwd: root, stdio: 'pipe' });
  } catch (error) {
    // Копилефт выставляет ненулевой код возврата — это ожидаемо.
    if (error.status !== 2) throw error;
  }

  const rows = readFileSync(join(outDir, 'license-map.csv'), 'utf8').split('\n');
  const row = (prefix) => rows.find((line) => line.startsWith(`${prefix},`)) ?? '';

  assert.match(row('plain-pkg'), /,MIT,/u, 'простое имя разрешается по складу');
  assert.match(row('plain-pkg'), /Installed package manifest:/u, 'происхождение названо явно');
  assert.match(row('@scope/pkg'), /,Apache-2\.0,/u, 'скоуп разрешается и не теряется в имени');
  assert.match(row('legacy-pkg'), /,ISC,/u, 'старая форма licenses[] тоже читается');

  // Отказы: ни один не превращается в догадку.
  assert.match(row('wrong-version'), /,UNKNOWN_REVIEW,/u, 'несовпадение версии — не доказательство');
  assert.doesNotMatch(row('wrong-version'), /Installed package manifest:/u);
  assert.match(row('absent-pkg'), /,UNKNOWN_REVIEW,/u, 'отсутствующий пакет остаётся неизвестным');

  // Политика не ослабляется тем, что лицензию наконец удалось прочитать.
  assert.match(row('copyleft-pkg'), /,BLOCKED_STRONG_COPYLEFT_OR_SOURCE_AVAILABLE,/u);

  const summary = JSON.parse(readFileSync(join(outDir, 'license-summary.json'), 'utf8'));
  assert.equal(summary.licensesResolvedFromInstalledArtifact, 4);
  assert.equal(summary.classifications.UNKNOWN_REVIEW, 2);
});
