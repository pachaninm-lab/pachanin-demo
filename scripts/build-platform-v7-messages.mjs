#!/usr/bin/env node
// Генерирует apps/web/messages/{en,zh}.json из ru.json по общему словарю
// apps/web/public/platform-v7/i18n/dictionaries.json. Русский файл — источник
// правды по структуре и копии; словарь — источник правды по переводам.
// Падает, если для какой-то строки нет перевода: сначала пополните словарь.
import fs from 'node:fs';
import path from 'node:path';

const RU_PATH = path.resolve('apps/web/messages/ru.json');
const DICTIONARY_PATH = path.resolve('apps/web/public/platform-v7/i18n/dictionaries.json');
const OUT_DIR = path.resolve('apps/web/messages');
const TARGETS = ['en', 'zh'];

const normalize = (value) => value.replace(/\s+/g, ' ').trim();

const ru = JSON.parse(fs.readFileSync(RU_PATH, 'utf8'));
const dictionaries = JSON.parse(fs.readFileSync(DICTIONARY_PATH, 'utf8')).dictionaries;

const missing = [];

function translateTree(node, language, trail) {
  if (typeof node === 'string') {
    const translated = dictionaries[language][normalize(node)];
    if (!translated) {
      missing.push(`${language}: ${trail.join('.')} -> ${node}`);
      return node;
    }
    return translated;
  }
  if (Array.isArray(node)) return node.map((item, index) => translateTree(item, language, [...trail, String(index)]));
  return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, translateTree(value, language, [...trail, key])]));
}

for (const language of TARGETS) {
  const tree = translateTree(ru, language, []);
  if (!missing.length) {
    fs.writeFileSync(path.join(OUT_DIR, `${language}.json`), JSON.stringify(tree, null, 2) + '\n', 'utf8');
  }
}

if (missing.length) {
  console.error('[p7-messages] Missing dictionary translations:');
  missing.slice(0, 60).forEach((line) => console.error(`- ${line}`));
  process.exit(1);
}
console.log(`[p7-messages] OK: generated ${TARGETS.map((l) => `${l}.json`).join(', ')} from ru.json`);
