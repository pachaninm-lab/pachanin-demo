#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const DICTIONARY_PATH = path.resolve('apps/web/public/platform-v7/i18n/dictionaries.json');
const REQUIRED_LANGUAGES = ['en', 'zh'];
const CYRILLIC_RE = /[А-Яа-яЁё]/;
const ALLOWED_CYRILLIC_VALUE_RE = /^(ФГИС|СДИЗ|ЭДО)$/;

function fail(message, details = []) {
  console.error(`\n[p7-i18n] ${message}`);
  details.slice(0, 80).forEach((item) => console.error(`- ${item}`));
  if (details.length > 80) console.error(`- ...and ${details.length - 80} more`);
  process.exitCode = 1;
}

function readPayload() {
  const raw = fs.readFileSync(DICTIONARY_PATH, 'utf8');
  return JSON.parse(raw);
}

const payload = readPayload();
const dictionaries = payload.dictionaries ?? {};
const missingLanguages = REQUIRED_LANGUAGES.filter((language) => !dictionaries[language] || typeof dictionaries[language] !== 'object');
if (missingLanguages.length) fail('Missing required dictionaries.', missingLanguages);

const keySets = Object.fromEntries(REQUIRED_LANGUAGES.map((language) => [language, new Set(Object.keys(dictionaries[language] ?? {}))]));
const baseKeys = [...keySets.en].sort((a, b) => a.localeCompare(b, 'ru'));

for (const language of REQUIRED_LANGUAGES) {
  const missing = baseKeys.filter((key) => !keySets[language].has(key));
  const extra = [...keySets[language]].filter((key) => !keySets.en.has(key)).sort((a, b) => a.localeCompare(b, 'ru'));
  if (missing.length) fail(`Dictionary '${language}' is missing keys from 'en'.`, missing);
  if (extra.length) fail(`Dictionary '${language}' contains keys absent from 'en'.`, extra);
}

for (const language of REQUIRED_LANGUAGES) {
  const emptyValues = Object.entries(dictionaries[language]).filter(([, value]) => typeof value !== 'string' || !value.trim()).map(([key]) => key);
  if (emptyValues.length) fail(`Dictionary '${language}' has empty values.`, emptyValues);
}

const zhCyrillic = Object.entries(dictionaries.zh ?? {})
  .filter(([, value]) => typeof value === 'string' && CYRILLIC_RE.test(value) && !ALLOWED_CYRILLIC_VALUE_RE.test(value.trim()))
  .map(([key, value]) => `${key} -> ${value}`);
if (zhCyrillic.length) fail("Dictionary 'zh' contains Cyrillic text in values.", zhCyrillic);

if (process.exitCode) process.exit(process.exitCode);
console.log(`[p7-i18n] OK: ${baseKeys.length} keys, languages: ${REQUIRED_LANGUAGES.join(', ')}`);
