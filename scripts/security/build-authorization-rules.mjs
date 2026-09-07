#!/usr/bin/env node
/**
 * Правила авторизации: уровень функций и уровень данных (ASVS V8.1.1).
 *
 * Ограничения в этом дереве сильные и стоят в двух слоях — роли на входе и
 * политики RLS в базе. Чего не было, так это утверждения о том, какими они
 * задуманы: реализацию не с чем сравнить, и рецензент читает код вместо правила.
 *
 * Реестр несёт намерение, которого сканер не выведет: что роль вправе делать и
 * что ограничивает каждый признак ресурса. Словарь при этом измеряется по дереву
 * на каждой сборке, и расхождение в любую сторону роняет её: роль, появившаяся в
 * @Roles и не описанная в реестре, и запись реестра о роли, которой в дереве уже
 * нет, одинаково недопустимы.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

export const REGISTRY = 'docs/security/authorization-rules-registry.json';
export const RULES_MD = 'docs/security/AUTHORIZATION_RULES.md';
export const API_ROOT = 'apps/api/src';
export const RLS_ROOT = 'infra/sql';

const TS = /\.ts$/u;
const FIXTURE = /\.(?:spec|test)\.ts$/u;

export function tracked(roots, filter) {
  return execFileSync('git', ['ls-files', '-z', ...roots], { encoding: 'utf8' })
    .split('\0').filter(Boolean).filter(filter);
}

/** Роли, реально стоящие на обработчиках, вместе с числом мест. */
export function measureRoles(files, read = (p) => readFileSync(p, 'utf8')) {
  const roles = new Map();
  let sites = 0;
  let publicSites = 0;
  for (const file of files) {
    const source = read(file);
    for (const match of source.matchAll(/@Roles\(([^)]*)\)/gu)) {
      sites += 1;
      for (const name of match[1].matchAll(/'([A-Z_]+)'|\b([A-Z_]{3,})\b/gu)) {
        const role = name[1] ?? name[2];
        roles.set(role, (roles.get(role) ?? 0) + 1);
      }
    }
    publicSites += [...source.matchAll(/@Public\(\)/gu)].length;
  }
  return { roles, sites, publicSites };
}

/** Признаки ресурса, по которым политики RLS принимают решение. */
export function measureResourceAttributes(files, read = (p) => readFileSync(p, 'utf8')) {
  const attributes = new Map();
  const policies = new Map();
  for (const file of files) {
    const source = read(file);
    for (const match of source.matchAll(/current_setting\('([a-z_.]+)'/gu)) {
      attributes.set(match[1], (attributes.get(match[1]) ?? 0) + 1);
    }
    const count = [...source.matchAll(/CREATE POLICY/gu)].length;
    if (count > 0) policies.set(file, count);
  }
  return { attributes, policies };
}

export function measure(read = (p) => readFileSync(p, 'utf8')) {
  const apiFiles = tracked([API_ROOT], (p) => TS.test(p) && !FIXTURE.test(p));
  const sqlFiles = tracked([RLS_ROOT], (p) => p.endsWith('.sql'));
  return {
    ...measureRoles(apiFiles, read),
    ...measureResourceAttributes(sqlFiles, read),
    apiFiles: apiFiles.length,
    sqlFiles: sqlFiles.length,
  };
}

const missing = (measured, declared) => [...measured].filter((k) => !declared.has(k)).sort();

export function reconcile(measured, registry) {
  const declaredRoles = new Set((registry.roles || []).map((r) => r.id));
  const declaredAttributes = new Set((registry.resourceAttributes || []).map((a) => a.id));
  const declaredPolicyFiles = new Set(registry.policyFiles || []);

  const problems = [];
  const undocumentedRoles = missing(measured.roles.keys(), declaredRoles);
  const phantomRoles = missing(declaredRoles, new Set(measured.roles.keys()));
  const undocumentedAttributes = missing(measured.attributes.keys(), declaredAttributes);
  const phantomAttributes = missing(declaredAttributes, new Set(measured.attributes.keys()));
  const undocumentedPolicyFiles = missing(measured.policies.keys(), declaredPolicyFiles);
  const phantomPolicyFiles = missing(declaredPolicyFiles, new Set(measured.policies.keys()));

  const add = (kind, detail, keys) => { if (keys.length > 0) problems.push({ kind, detail, keys }); };
  add('UNDOCUMENTED_ROLE', 'a role gates a handler but no rule says what it may do', undocumentedRoles);
  add('PHANTOM_ROLE', 'a documented role gates nothing in the tree', phantomRoles);
  add('UNDOCUMENTED_RESOURCE_ATTRIBUTE', 'a row-level policy decides on an attribute no rule describes', undocumentedAttributes);
  add('PHANTOM_RESOURCE_ATTRIBUTE', 'a documented attribute no policy reads', phantomAttributes);
  add('UNDOCUMENTED_POLICY_FILE', 'a file defines row-level policies the rules do not account for', undocumentedPolicyFiles);
  add('PHANTOM_POLICY_FILE', 'the rules name a policy file that no longer defines any policy', phantomPolicyFiles);

  for (const role of registry.roles || []) {
    if (String(role.mayDo || '').trim().length < 15) {
      problems.push({ kind: 'RULE_WITHOUT_CONTENT', detail: 'a role entry that does not say what the role may do', keys: [role.id] });
    }
  }
  for (const attribute of registry.resourceAttributes || []) {
    if (String(attribute.restricts || '').trim().length < 15 || String(attribute.setBy || '').trim().length < 3) {
      problems.push({ kind: 'RULE_WITHOUT_CONTENT', detail: 'an attribute entry that does not say what it restricts or who sets it', keys: [attribute.id] });
    }
  }

  return problems;
}

export function renderRules(measured, registry) {
  const lines = [
    '# Правила авторизации',
    '',
    'Сгенерировано `scripts/security/build-authorization-rules.mjs`. Не редактировать вручную.',
    '',
    'Намерение — что роль вправе делать и что ограничивает признак ресурса — взято из',
    '`docs/security/authorization-rules-registry.json`. Словарь ролей, признаков и файлов',
    'политик измерен по дереву.',
    '',
    `Ролей: ${registry.roles.length}. Мест \`@Roles\`: ${measured.sites}. Мест \`@Public\`: ${measured.publicSites}.`,
    `Признаков ресурса: ${registry.resourceAttributes.length}. Файлов политик: ${measured.policies.size}.`,
    '',
    '## Уровень функций',
    '',
    registry.functionLevel,
    '',
    '| Роль | Что вправе делать | Мест |',
    '| --- | --- | ---: |',
  ];
  for (const role of [...registry.roles].sort((a, b) => a.id.localeCompare(b.id, 'en'))) {
    lines.push(`| \`${role.id}\` | ${role.mayDo} | ${measured.roles.get(role.id) ?? 0} |`);
  }

  lines.push('', '## Уровень данных', '', registry.dataLevel, '', '| Признак ресурса | Что ограничивает | Кто устанавливает |', '| --- | --- | --- |');
  for (const attribute of [...registry.resourceAttributes].sort((a, b) => a.id.localeCompare(b.id, 'en'))) {
    lines.push(`| \`${attribute.id}\` | ${attribute.restricts} | ${attribute.setBy} |`);
  }

  lines.push('', '### Файлы политик', '');
  for (const [file, count] of [...measured.policies].sort()) {
    lines.push(`- \`${file}\` — политик: ${count}`);
  }

  lines.push('', '## Чего эти правила НЕ покрывают', '', registry.notCovered);
  return `${lines.join('\n').trimEnd()}\n`;
}

function main() {
  const registry = JSON.parse(readFileSync(REGISTRY, 'utf8'));
  const measured = measure();
  const problems = reconcile(measured, registry);
  if (problems.length > 0) {
    for (const problem of problems) console.error(`${problem.kind}: ${problem.detail} — ${problem.keys.join(', ')}`);
    process.exit(1);
  }
  writeFileSync(RULES_MD, renderRules(measured, registry));
  console.log(
    `AUTHORIZATION_RULES: roles=${registry.roles.length} roleSites=${measured.sites} publicSites=${measured.publicSites} resourceAttributes=${registry.resourceAttributes.length} policyFiles=${measured.policies.size}`,
  );
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main();
}
