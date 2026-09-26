#!/usr/bin/env node
/**
 * Что несёт поставляемый артефакт, а не что объявляет репозиторий.
 *
 * SBOM строится по рабочему пространству и включает всё — dev, optional,
 * платформенные варианты для чужих архитектур. Юридическое значение имеет
 * другое: файлы, которые физически попали в образ и уезжают пользователю.
 * Этот гейт читает уже развёрнутое прод-дерево (`pnpm --prod deploy`) и
 * отказывает, если в нём лежит копилефт-обязательство, которое никто
 * сознательно не принимал.
 *
 * Измерено на дереве веба до появления этого гейта: `@img/sharp-libvips-linux-x64`
 * и `@img/sharp-libvips-linuxmusl-x64`, обе LGPL-3.0-or-later, 18 МБ каждая,
 * ехали в образ как optional-зависимость Next для оптимизатора картинок,
 * которым продукт не пользуется ни в одном файле.
 *
 * Отказ по умолчанию. Обязательство проходит только если оно записано в
 * allowlist с причиной, или если пакет предлагает пермиссивную ветку выбора
 * и выбор зафиксирован в третьесторонних override-ах.
 */
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';

const treeDir = process.argv[2];
const allowlistPath = process.argv[3] ?? 'docs/ip/shipped-license-allowlist.json';
const overridesPath = process.argv[4] ?? 'docs/ip/third-party-license-overrides.json';

/**
 * Семейства лицензий, которые накладывают обязательство на распространителя.
 * Порядок проверки не важен — совпадение любого токена делает пакет отказным
 * до предъявления записанного основания.
 */
export const OBLIGATION_TOKENS = Object.freeze([
  'AGPL',
  'GPL',
  'LGPL',
  'SSPL',
  'BUSL',
  'CDDL',
  'EPL',
  'OSL',
  'CPAL',
  'CC-BY',
  'MPL',
]);

/**
 * Токен ищется как отдельное слово внутри SPDX-выражения.
 *
 * Наивный `includes('GPL')` совпадает и на `LGPL`, и это не ошибка — оба
 * несут обязательство. Но он же совпал бы на выдуманном `NOTGPL`, поэтому
 * границы всё равно проверяются.
 */
export function obligationsIn(expression) {
  const text = String(expression ?? '').toUpperCase();
  const found = [];
  for (const token of OBLIGATION_TOKENS) {
    const pattern = new RegExp(`(^|[^A-Z0-9-])${token}(?![A-Z0-9])`, 'u');
    if (pattern.test(text)) found.push(token);
  }
  return found;
}

/**
 * Дизъюнкция даёт право выбрать ветку; выбор обязан быть записан.
 *
 * `(MIT OR GPL-3.0-or-later)` не является обязательством, ЕСЛИ выбор в пользу
 * MIT зафиксирован. Без записи это по-прежнему отказ: право выбора,
 * которым никто не воспользовался письменно, доказательством не является.
 *
 * OR обязан быть отдельным оператором, а не куском идентификатора. Первая
 * версия использовала `\bOR\b`, и собственный тест это уронил: в
 * `GPL-3.0-or-later` дефис — граница слова, поэтому выражение считалось
 * выбором. Тогда любая `-or-later` лицензия при наличии записи о выборе
 * прошла бы гейт насквозь — ровно та дыра, ради которой гейт и написан.
 */
export function isDisjunction(expression) {
  return String(expression ?? '')
    .toUpperCase()
    .split(/[\s()]+/u)
    .includes('OR');
}

export function normalizeKey(name, version) {
  return `${name}@${version}`;
}

/** Ключ purl, как его пишут третьесторонние override-ы. */
export function purlFor(name, version) {
  return `pkg:npm/${name}@${version}`;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function licenseOf(manifest) {
  const license = manifest?.license;
  if (typeof license === 'string') return license;
  if (license && typeof license === 'object' && typeof license.type === 'string') return license.type;
  const legacy = manifest?.licenses;
  if (Array.isArray(legacy)) {
    const parts = legacy
      .map((entry) => (typeof entry === 'string' ? entry : entry?.type))
      .filter((entry) => typeof entry === 'string' && entry.length > 0);
    if (parts.length > 0) return parts.join(' OR ');
  }
  return '';
}

/**
 * Обход дерева поставки.
 *
 * Виртуальный store pnpm целиком состоит из символических ссылок, и наивный
 * обход здесь неверен дважды. Первая версия этого обхода сделала обе ошибки
 * сразу, и они всплыли на настоящем дереве: гейт сообщил про `axe-core` и
 * `@axe-core/playwright`, которых в поставке нет вовсе.
 *
 * Ссылка `.pnpm/node_modules/@pc/web` ведёт ОБРАТНО в рабочую копию `apps/web`,
 * где лежат dev-зависимости. Обход уходил наружу из дерева поставки и объявлял
 * нарушением то, что пользователю не уезжает; путь при этом наматывался в
 * `apps/web/web/apps/web/web/…` без конца и обрывался только счётчиком.
 *
 * Поэтому: каждый каталог приводится к реальному пути, и он обязан лежать
 * ВНУТРИ корня дерева, а каждый реальный путь посещается один раз. Первое
 * убирает ложные срабатывания, второе — зацикливание. Счётчик остаётся
 * последним рубежом, а не единственным.
 */
export function collectManifests(root, limit = 200_000) {
  const found = [];
  if (!existsSync(root)) return found;

  let rootReal;
  try {
    rootReal = realpathSync(root);
  } catch {
    return found;
  }
  const containment = rootReal.endsWith(sep) ? rootReal : `${rootReal}${sep}`;

  const seenDirectories = new Set([rootReal]);
  const stack = [rootReal];
  let visited = 0;

  while (stack.length > 0 && visited < limit) {
    const current = stack.pop();
    visited += 1;
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const path = join(current, entry.name);
      if (entry.name === 'package.json') {
        try {
          if (statSync(path).isFile()) found.push(path);
        } catch {
          /* недоступный путь — не доказательство отсутствия, но и не пакет */
        }
        continue;
      }
      if (entry.name.startsWith('.') && entry.name !== '.pnpm') continue;

      let real;
      try {
        real = realpathSync(path);
        if (!statSync(real).isDirectory()) continue;
      } catch {
        continue;
      }
      // Наружу дерева поставки не выходим: то, что там лежит, пользователю не уезжает.
      if (real !== rootReal && !real.startsWith(containment)) continue;
      if (seenDirectories.has(real)) continue;
      seenDirectories.add(real);
      stack.push(real);
    }
  }
  return found;
}

export function evaluate(manifests, { allowlist, elections }) {
  const seen = new Map();
  for (const { name, version, license } of manifests) {
    if (!name || !version) continue;
    const key = normalizeKey(name, version);
    if (!seen.has(key)) seen.set(key, { name, version, license });
  }

  const violations = [];
  const accepted = [];
  for (const record of seen.values()) {
    const obligations = obligationsIn(record.license);
    if (obligations.length === 0) continue;

    const key = normalizeKey(record.name, record.version);
    const allowed = allowlist.get(key);
    if (allowed) {
      accepted.push({ ...record, obligations, reason: allowed.reason, basis: 'ALLOWLIST' });
      continue;
    }

    const elected = elections.get(purlFor(record.name, record.version));
    if (elected && isDisjunction(record.license) && obligationsIn(elected).length === 0) {
      accepted.push({ ...record, obligations, reason: elected, basis: 'ELECTION' });
      continue;
    }

    violations.push({ ...record, obligations });
  }

  violations.sort((left, right) => normalizeKey(left.name, left.version).localeCompare(normalizeKey(right.name, right.version)));
  accepted.sort((left, right) => normalizeKey(left.name, left.version).localeCompare(normalizeKey(right.name, right.version)));
  return { violations, accepted, inspected: seen.size };
}

function main() {
  if (!treeDir) {
    console.error('usage: verify-shipped-licenses.mjs <deployed-tree> [allowlist] [overrides]');
    process.exit(2);
  }
  if (!existsSync(treeDir)) {
    console.error(`SHIPPED_LICENSES: дерево не найдено: ${treeDir}`);
    process.exit(2);
  }

  const allowlist = new Map();
  if (existsSync(allowlistPath)) {
    for (const entry of readJson(allowlistPath).allowed ?? []) {
      if (!entry?.package || !entry?.reason) continue;
      allowlist.set(entry.package, entry);
    }
  }

  const elections = new Map();
  if (existsSync(overridesPath)) {
    for (const entry of readJson(overridesPath).overrides ?? []) {
      if (entry?.purl && entry?.electedLicense) elections.set(entry.purl, entry.electedLicense);
    }
  }

  const manifests = [];
  for (const path of collectManifests(join(treeDir, 'node_modules'))) {
    let manifest;
    try {
      manifest = readJson(path);
    } catch {
      continue;
    }
    manifests.push({ name: manifest?.name, version: manifest?.version, license: licenseOf(manifest) });
  }

  const { violations, accepted, inspected } = evaluate(manifests, { allowlist, elections });

  console.log(`SHIPPED_LICENSES: ${inspected} пакетов в поставляемом дереве ${treeDir}`);
  for (const entry of accepted) {
    console.log(`  принято (${entry.basis}): ${normalizeKey(entry.name, entry.version)} — ${entry.license} — ${entry.reason}`);
  }
  if (violations.length > 0) {
    console.error('SHIPPED_LICENSES: FAIL — обязательство в поставляемом артефакте без записанного основания:');
    for (const entry of violations) {
      console.error(`  ${normalizeKey(entry.name, entry.version)} — ${entry.license} (${entry.obligations.join(', ')})`);
    }
    console.error('Либо уберите пакет из поставки, либо запишите основание в docs/ip/shipped-license-allowlist.json.');
    process.exit(1);
  }
  console.log('SHIPPED_LICENSES: PASS — необеспеченных копилефт-обязательств в поставке нет');
}

if (process.argv[1] && process.argv[1].endsWith('verify-shipped-licenses.mjs')) main();
