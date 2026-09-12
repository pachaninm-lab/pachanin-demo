import { strict as assert } from 'node:assert';
import test from 'node:test';

import {
  declaredInternalDependencies,
  importedInternalSpecifiers,
  internalNames,
  internalScopes,
  isInternalSpecifier,
  lockfileInternalResolutions,
  manifestPaths,
  packageNameOf,
  registryOverrides,
  unresolvableInternalImports,
} from './verify-dependency-confusion.mjs';

const NAMES = new Set(['@pc/web', '@pc/domain-core', '@pachanin/integration-sdk', 'prozrachnaya-cena-runtime']);
const SCOPES = internalScopes(NAMES);

test('owned scopes are derived from our own manifests, not from a list to remember', () => {
  assert.deepEqual([...internalScopes(new Set(['@pc/web', '@pachanin/sdk', 'plain']))].sort(), ['@pachanin', '@pc']);
  assert.deepEqual([...internalNames([{ name: '@pc/web' }, {}, { name: 'root' }])].sort(), ['@pc/web', 'root']);
});

/**
 * The attack does not need a package we already have. It needs a name inside a
 * scope somebody could claim, so the whole scope is ours to defend - including
 * names nobody has created yet.
 */
test('any name in an owned scope is internal, including one we do not have', () => {
  assert.equal(isInternalSpecifier('@pc/web', NAMES, SCOPES), true);
  assert.equal(isInternalSpecifier('@pc/never-created', NAMES, SCOPES), true);
  assert.equal(isInternalSpecifier('prozrachnaya-cena-runtime', NAMES, SCOPES), true);
  assert.equal(isInternalSpecifier('react', NAMES, SCOPES), false);
  assert.equal(isInternalSpecifier('@types/node', NAMES, SCOPES), false);
});

test('a deep import resolves to the package it would install', () => {
  assert.equal(packageNameOf('@pc/design-system-v8/styles.css'), '@pc/design-system-v8');
  assert.equal(packageNameOf('@pc/design-system-v8'), '@pc/design-system-v8');
  assert.equal(packageNameOf('lodash/merge'), 'lodash');
});

test('an internal dependency may be declared by protocol, never by version range', () => {
  const byProtocol = [{ path: 'apps/web/package.json', manifest: { dependencies: { '@pc/domain-core': 'workspace:*' }, devDependencies: { '@pachanin/integration-sdk': 'link:../x' } } }];
  assert.deepEqual(declaredInternalDependencies(byProtocol, NAMES, SCOPES), []);
  const byRange = [{ path: 'apps/web/package.json', manifest: { dependencies: { '@pc/domain-core': '^1.0.0' } } }];
  const offences = declaredInternalDependencies(byRange, NAMES, SCOPES);
  assert.equal(offences.length, 1);
  assert.match(offences[0], /never a version range/u);
});

test('a third-party dependency by version range is not an offence', () => {
  assert.deepEqual(
    declaredInternalDependencies([{ path: 'p', manifest: { dependencies: { react: '^18.0.0' } } }], NAMES, SCOPES),
    [],
  );
});

test('an internal name resolved in the lockfile is an offence; a third-party one is not', () => {
  const lock = ["packages:", "  '@pc/domain-core@1.0.0':", '    resolution: {integrity: sha512-x}', "  react@18.3.1:"].join('\n');
  const offences = lockfileInternalResolutions(lock, NAMES, SCOPES);
  assert.equal(offences.length, 1);
  assert.match(offences[0], /@pc\/domain-core/u);
  assert.deepEqual(lockfileInternalResolutions(["packages:", '  react@18.3.1:'].join('\n'), NAMES, SCOPES), []);
});

/**
 * The rule that is load-bearing today. Two packages carrying internal names are
 * deliberately outside the pnpm workspace and one of them is imported by 62
 * files; what keeps that off the registry is a path alias, and nothing else.
 */
test('an imported internal name must be a workspace package or an explicit alias', () => {
  const imported = new Map([['@pc/design-system-v8', ['apps/web/a.tsx']]]);
  assert.deepEqual(unresolvableInternalImports(imported, NAMES, SCOPES, new Set(['@pc/design-system-v8'])), []);
  assert.deepEqual(unresolvableInternalImports(imported, new Set([...NAMES, '@pc/design-system-v8']), SCOPES, new Set()), []);
  const offences = unresolvableInternalImports(imported, NAMES, SCOPES, new Set());
  assert.equal(offences.length, 1);
  assert.match(offences[0], /resolves it from the public registry/u);
});

test('a wildcard alias covers the package it names', () => {
  const imported = new Map([['@pc/design-system-v8/button', ['a.tsx']]]);
  assert.deepEqual(unresolvableInternalImports(imported, NAMES, SCOPES, new Set(['@pc/design-system-v8/*'])), []);
});

test('a third-party import is never an offence however it resolves', () => {
  assert.deepEqual(unresolvableInternalImports(new Map([['react', ['a.tsx']]]), NAMES, SCOPES, new Set()), []);
});

test('specifiers are collected from import, from and require alike', () => {
  const found = importedInternalSpecifiers(['a.ts'], () => [
    "import { a } from '@pc/one';",
    "const b = require('@pc/two');",
    "import '@pc/three';",
    "import x from './relative';",
  ].join('\n'));
  assert.deepEqual([...found.keys()].sort(), ['@pc/one', '@pc/three', '@pc/two'],
    'a relative specifier resolves to a file and can never reach a registry, so it is not collected');
});

test('a registry override on an owned scope must be https; other scopes are none of our business', () => {
  assert.equal(registryOverrides('@pc:registry=http://internal\n', SCOPES).length, 1);
  assert.deepEqual(registryOverrides('@pc:registry=https://registry.npmjs.org\n', SCOPES), []);
  assert.deepEqual(registryOverrides('@other:registry=http://internal\n', SCOPES), []);
});

test('only root and one-level app or package manifests are read', () => {
  const tracked = ['package.json', 'apps/web/package.json', 'packages/x/package.json',
    'apps/web/node_modules/react/package.json', 'apps/web/tests/fixtures/package.json'];
  assert.deepEqual(manifestPaths(tracked), ['package.json', 'apps/web/package.json', 'packages/x/package.json']);
});
