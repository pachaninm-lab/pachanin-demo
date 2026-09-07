#!/usr/bin/env node
/**
 * Опись внешних коммуникаций приложения (ASVS V13.1.1).
 *
 * Половину описи нельзя вывести из кода: зачем идёт вызов и что происходит при
 * отказе. Эта половина лежит в реестре и пишется человеком. Всё остальное -
 * места вызовов, переменные окружения, наличие аутентификации, ограничение по
 * времени - измеряется по исходникам при каждой сборке.
 *
 * Опись не может тихо устареть: модуль с исходящим вызовом, которого нет в
 * реестре, роняет сборку, и запись реестра, под которой не осталось ни одного
 * вызова, тоже роняет её.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

export const SCAN_ROOTS = ['apps/api/src'];
export const REGISTRY_PATH = 'docs/security/external-communications-registry.json';
export const INVENTORY_JSON = 'docs/security/external-communications-inventory.json';
export const INVENTORY_MD = 'docs/security/EXTERNAL_COMMUNICATIONS.md';

const SOURCE = /\.ts$/u;
const FIXTURE = /\.(?:spec|test)\.ts$/u;
const FETCH_CALL = /(?:^|[^.\w$])fetch\s*\(/gu;
const BOUNDED = /AbortSignal\.timeout|AbortController|(?:^|[\s,{])signal\s*[,:}]/u;
const AUTH = /Authorization|X-Vault-Token|X-Api-Key/iu;

/**
 * fetch не единственный исходящий транспорт.
 *
 * Первая версия этой описи искала только `fetch(` и потому не увидела два
 * реальных внешних канала: SSRF-защищённый запрос к вебхуку партнёра идёт через
 * request() из node:https, а почта уходит через connect() из node:net/node:tls.
 * Опись, не видящая транспорт, — это документ, утверждающий полноту, которой нет.
 *
 * Учитываются только функции, действительно открывающие соединение. isIP из
 * node:net разбирает адрес и не является транспортом; createServer из node:http
 * принимает входящие соединения, а не устанавливает исходящие.
 */
export const OUTBOUND_NODE_IMPORTS = {
  'node:http': ['request', 'get'],
  'node:https': ['request', 'get'],
  'node:net': ['connect', 'createConnection'],
  'node:tls': ['connect'],
};

/** Локальные имена, связанные с исходящими функциями Node, по операторам import. */
export function outboundBindings(source) {
  const bindings = new Set();
  const importPattern = /import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/gu;
  for (const match of source.matchAll(importPattern)) {
    const outbound = OUTBOUND_NODE_IMPORTS[match[2]];
    if (!outbound) continue;
    for (const clause of match[1].split(',')) {
      const parts = clause.trim().split(/\s+as\s+/u);
      const imported = parts[0].replace(/^type\s+/u, '').trim();
      const local = (parts[1] || imported).trim();
      if (outbound.includes(imported) && local) bindings.add(local);
    }
  }
  return bindings;
}

/** Аргументы вызова по балансу скобок: окно строк обрезает длинный вызов. */
export function callArguments(source, open) {
  let depth = 0;
  let quote = '';
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (char === '\\') index += 1;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '(') depth += 1;
    else if (char === ')') {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, index);
    }
  }
  return '';
}

export function measureModule(source) {
  const fetchCalls = [];
  for (const match of source.matchAll(FETCH_CALL)) {
    const open = source.indexOf('(', match.index);
    if (open < 0) continue;
    fetchCalls.push(callArguments(source, open));
  }

  // Discovery keys on the import, never on a call-site name. safe-outbound-request.ts
  // assigns its transport to a variable first - `const send = isHttps ? httpsRequest
  // : httpRequest` - so counting calls to the imported name finds nothing there. An
  // import cannot be aliased away; a call site can.
  const nodeTransports = [...outboundBindings(source)].sort();
  if (fetchCalls.length === 0 && nodeTransports.length === 0) return null;

  return {
    transports: [...(fetchCalls.length > 0 ? ['fetch'] : []), ...nodeTransports],
    fetchCallSites: fetchCalls.length,
    environment: [...new Set([...source.matchAll(/process\.env\.([A-Z0-9_]+)/gu)].map((m) => m[1]))].sort(),
    carriesAuthentication: AUTH.test(source),
    everyFetchCallBounded: fetchCalls.every((args) => BOUNDED.test(args)),
  };
}

export function trackedSources(roots = SCAN_ROOTS) {
  return execFileSync('git', ['ls-files', '-z', ...roots], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean)
    .filter((path) => SOURCE.test(path) && !FIXTURE.test(path));
}

export function discoverOutboundModules(roots = SCAN_ROOTS) {
  const found = new Map();
  for (const file of trackedSources(roots)) {
    const measured = measureModule(readFileSync(file, 'utf8'));
    if (measured) found.set(file, measured);
  }
  return found;
}

export function reconcile(discovered, registry) {
  const registered = new Map();
  for (const system of registry.systems || []) {
    for (const module of system.modules || []) registered.set(module, system);
  }

  const unregistered = [...discovered.keys()].filter((module) => !registered.has(module)).sort();
  const phantom = [...registered.keys()].filter((module) => !discovered.has(module)).sort();
  return { registered, unregistered, phantom };
}

/**
 * Заявленный способ аутентификации обязан сходиться с измеренным.
 *
 * Реестр пишет человек, и без этой сверки он может утверждать защиту, которой в
 * коде нет. Способ `header` требует, чтобы заголовок авторизации действительно
 * присутствовал; любой другой способ требует, чтобы его там не было - иначе
 * запись описывает не тот вызов, который выполняется.
 */
export const AUTHENTICATION_KINDS = new Set([
  'header',
  'url-path-token',
  'request-body-token',
  'transport-allowlist',
  'protocol-session',
  'none',
]);

export function authenticationMismatches(systems) {
  const mismatches = [];
  for (const system of systems) {
    const kind = String(system.authenticationKind || '');
    if (!AUTHENTICATION_KINDS.has(kind)) {
      mismatches.push(`${system.id}: unknown authenticationKind ${JSON.stringify(kind)}`);
      continue;
    }
    const expected = kind === 'header';
    if (system.carriesAuthentication !== expected) {
      mismatches.push(
        `${system.id}: declares ${kind} but an authorization header is ${system.carriesAuthentication ? 'present' : 'absent'} in source`,
      );
    }
  }
  return mismatches;
}

export function buildInventory(discovered, registry) {
  const { registered, unregistered, phantom } = reconcile(discovered, registry);
  if (unregistered.length > 0 || phantom.length > 0) {
    return { unregistered, phantom, mismatches: [], systems: [] };
  }

  const systems = (registry.systems || []).map((system) => {
    const modules = [...system.modules].sort().map((module) => ({ module, ...discovered.get(module) }));
    return {
      id: system.id,
      name: system.name,
      need: system.need,
      dataClass: system.dataClass,
      authentication: system.authentication,
      onFailure: system.onFailure,
      authenticationKind: system.authenticationKind,
      degradesSilently: system.degradesSilently === true,
      userSuppliedDestination: system.userSuppliedDestination === true,
      carriesAuthentication: modules.some((entry) => entry.carriesAuthentication),
      everyFetchCallBounded: modules.every((entry) => entry.everyFetchCallBounded),
      fetchCallSites: modules.reduce((total, entry) => total + entry.fetchCallSites, 0),
      transports: [...new Set(modules.flatMap((entry) => entry.transports))].sort(),
      modules,
    };
  }).sort((left, right) => left.id.localeCompare(right.id, 'en'));

  return { unregistered, phantom, mismatches: authenticationMismatches(systems), systems };
}

export function renderMarkdown(inventory) {
  const lines = [
    '# Опись внешних коммуникаций',
    '',
    'Сгенерировано `scripts/security/build-external-communications-inventory.mjs`. Не редактировать вручную.',
    '',
    'Назначение, класс данных и поведение при отказе взяты из',
    '`docs/security/external-communications-registry.json`. Места вызовов, переменные',
    'окружения, наличие аутентификации и ограничение по времени измерены по исходникам.',
    '',
    `Систем: ${inventory.systems.length}. Мест вызова fetch: ${inventory.systems.reduce((t, s) => t + s.fetchCallSites, 0)}.`,
    '',
    'Столбец «вызовов» считает только места вызова `fetch`. Транспорты `node:http`,',
    '`node:https`, `node:net` и `node:tls` обнаруживаются по импорту, потому что вызов',
    'может идти через переменную; для них счёт мест не заявляется.',
    '',
    '| Система | Зачем | Класс данных | Аутентификация | При отказе | Транспорт | fetch | Ограничены |',
    '| --- | --- | --- | --- | --- | --- | ---: | --- |',
  ];

  for (const system of inventory.systems) {
    lines.push([
      '',
      system.name,
      system.need,
      system.dataClass,
      system.authenticationKind === 'none' ? '**НЕТ**' : system.authenticationKind,
      system.degradesSilently ? `${system.onFailure} **Деградирует молча.**` : system.onFailure,
      system.transports.map((t) => `\`${t}\``).join(', '),
      String(system.fetchCallSites),
      system.everyFetchCallBounded ? 'да' : '**нет**',
      '',
    ].join(' | ').trim());
  }

  const userSupplied = inventory.systems.filter((system) => system.userSuppliedDestination);
  lines.push(
    '',
    '## Адреса, которые задаёт пользователь',
    '',
    'V13.1.1 отдельно требует назвать случаи, когда внешний адрес назначения выбирает',
    'конечный пользователь, а не платформа.',
    '',
  );
  if (userSupplied.length === 0) {
    lines.push('Таких случаев нет.');
  } else {
    for (const system of userSupplied) {
      lines.push(`- **${system.name}** — ${system.need} Контроль: ${system.authentication}`);
    }
  }

  lines.push('', '## Модули', '');
  for (const system of inventory.systems) {
    lines.push(`### ${system.name} (\`${system.id}\`)`, '');
    for (const entry of system.modules) {
      const env = entry.environment.length > 0 ? entry.environment.map((name) => `\`${name}\``).join(', ') : '—';
      lines.push(`- \`${entry.module}\` — транспорт: ${entry.transports.join(', ')}; вызовов fetch: ${entry.fetchCallSites}; окружение: ${env}`);
    }
    lines.push('');
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

function main() {
  const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'));
  const discovered = discoverOutboundModules();
  const inventory = buildInventory(discovered, registry);

  if (inventory.mismatches.length > 0) {
    for (const mismatch of inventory.mismatches) console.error(`AUTHENTICATION_DECLARATION_MISMATCH ${mismatch}`);
    console.error('The registry declares an authentication posture the source does not carry.');
    process.exit(1);
  }

  if (inventory.unregistered.length > 0 || inventory.phantom.length > 0) {
    for (const module of inventory.unregistered) {
      console.error(`UNREGISTERED_OUTBOUND_MODULE ${module}`);
    }
    for (const module of inventory.phantom) {
      console.error(`REGISTERED_MODULE_HAS_NO_OUTBOUND_CALL ${module}`);
    }
    console.error(
      'The external-communications inventory is out of date. Every module that talks to an external system must be registered, and every registered module must still make an outbound call.',
    );
    process.exit(1);
  }

  const payload = {
    schemaVersion: 'pc-crop.external-communications-inventory.v1',
    scanRoots: SCAN_ROOTS,
    scannedFiles: trackedSources().length,
    systems: inventory.systems,
  };

  writeFileSync(INVENTORY_JSON, `${JSON.stringify(payload, null, 2)}\n`);
  writeFileSync(INVENTORY_MD, renderMarkdown(inventory));

  const unauthenticated = inventory.systems.filter((system) => system.authenticationKind === 'none');
  const silent = inventory.systems.filter((system) => system.degradesSilently);
  console.log(
    `EXTERNAL_COMMUNICATIONS: systems=${inventory.systems.length} fetchCallSites=${payload.systems.reduce((t, s) => t + s.fetchCallSites, 0)} unauthenticated=${unauthenticated.length} degradeSilently=${silent.length}`,
  );
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main();
}
