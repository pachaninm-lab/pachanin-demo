import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

/**
 * Реестр цепочки прав ведётся руками, и именно поэтому он способен разойтись
 * с репозиторием незаметно. Прежняя версия отстала на 1613 коммитов и на 31
 * файл ядра, и заметить это было нечем.
 *
 * Проверяется не «числа сегодня верны» — они меняются с каждым коммитом, и
 * такая проверка ломала бы сборку на ровном месте. Проверяется то, что от
 * окружения не зависит: идентификатор личности обязан быть выведен из
 * указанного рядом адреса, а не выглядеть правдоподобно.
 */
const REGISTER = 'docs/ip/CHAIN_OF_TITLE_REGISTER.md';
const text = readFileSync(REGISTER, 'utf8');

/** Тот же расчёт, что в scripts/ip/build-ip-clean-room.mjs. */
function contributorId(name, email) {
  const cleanName = String(name || 'UNKNOWN').replace(/\s+/g, ' ').trim() || 'UNKNOWN';
  const emailHash = createHash('sha256').update(String(email || 'UNKNOWN').trim().toLowerCase()).digest('hex').slice(0, 16);
  return `${cleanName}#${emailHash}`;
}

/** Строки таблиц вида | `имя#хеш` | `адрес` | … */
function identityRows() {
  const rows = [];
  const pattern = /^\|\s*`([^`]+#[0-9a-f]{16})`\s*\|\s*`([^`]+)`\s*\|/gmu;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    rows.push({ identity: match[1], address: match[2] });
  }
  return rows;
}

test('в реестре есть строки личностей с адресами', () => {
  const rows = identityRows();
  assert.ok(rows.length >= 15, `распознано строк: ${rows.length} — разбор таблицы сломан или таблицы вырезаны`);
});

test('каждый идентификатор выведен из указанного рядом адреса', () => {
  for (const { identity, address } of identityRows()) {
    const name = identity.slice(0, identity.lastIndexOf('#'));
    assert.equal(
      contributorId(name, address),
      identity,
      `${identity}: хеш не соответствует адресу ${address} — строка выдумана или адрес подменён`,
    );
  }
});

test('расчёт идентификатора совпадает с тем, что делает сборщик', () => {
  // Опорная точка: владелец репозитория. Если алгоритм разъедется, разойдётся и она.
  assert.equal(contributorId('pachaninm-lab', 'pachaninm@gmail.com'), 'pachaninm-lab#97bdb9e06bb3722c');
  // Регистр адреса не должен влиять на результат.
  assert.equal(contributorId('pachaninm-lab', 'PachaninM@Gmail.COM'), 'pachaninm-lab#97bdb9e06bb3722c');
  // Пустые значения не молчат, а дают явный UNKNOWN.
  assert.equal(contributorId('', ''), contributorId('UNKNOWN', 'UNKNOWN'));
});

test('объявленный Source SHA — настоящий коммит этого репозитория', () => {
  const declared = /^Source SHA:\s*`([0-9a-f]{40})`/mu.exec(text);
  assert.ok(declared, 'реестр обязан объявлять Source SHA полностью');
  const type = execFileSync('git', ['cat-file', '-t', declared[1]], { encoding: 'utf8' }).trim();
  assert.equal(type, 'commit', `${declared[1]} не является коммитом`);
});

test('реестр не объявляет ни одну строку RESOLVED без ссылки на инструмент', () => {
  // RESOLVED разрешён только там, где рядом стоит идентификатор документа.
  // Пока инструментов нет, слова RESOLVED в таблицах быть не должно вовсе.
  const tableLines = text.split('\n').filter((line) => line.trimStart().startsWith('|'));
  for (const line of tableLines) {
    assert.ok(
      !/\bRESOLVED\b/u.test(line) || /\bUNRESOLVED\b/u.test(line),
      `строка объявляет RESOLVED без ссылки на подписанный инструмент: ${line.trim()}`,
    );
  }
});

test('реестр продолжает различать личность и права', () => {
  assert.match(text, /Identity/u, 'раздел про личность обязан остаться');
  assert.match(text, /UNRESOLVED/u, 'права обязаны оставаться неразрешёнными, пока нет инструментов');
  assert.match(
    text,
    /fabricated PASS/u,
    'предупреждение о сфабрикованном PASS убирать нельзя: оно объясняет, почему строки не переводят в RESOLVED',
  );
});
