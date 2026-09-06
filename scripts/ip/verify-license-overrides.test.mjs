import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

/**
 * Файл разрешения лицензий — governance-запись, и она обязана оставаться
 * читаемой как решение, а не как штамп.
 *
 * Проверяется не «файл валиден», а то, что отличает доказательство от
 * заявления: у факта есть источник, у решения — названное обязательство,
 * записанное основание и то, что удерживает основание истинным.
 */
const overrides = JSON.parse(readFileSync('docs/ip/third-party-license-overrides.json', 'utf8'));
const entries = overrides.overrides ?? [];

const OBLIGATION_TOKENS = ['AGPL', 'GPL', 'LGPL', 'SSPL', 'BUSL', 'CDDL', 'EPL', 'OSL', 'CPAL', 'CC-BY', 'MPL'];

function carriesObligation(expression) {
  const text = String(expression ?? '').toUpperCase();
  return OBLIGATION_TOKENS.some((token) => new RegExp(`(^|[^A-Z0-9-])${token}(?![A-Z0-9])`, 'u').test(text));
}

function isDisjunction(expression) {
  return String(expression ?? '').toUpperCase().split(/[\s()]+/u).includes('OR');
}

test('файл не пуст и каждая запись адресует конкретный артефакт', () => {
  assert.ok(entries.length > 0, 'пустой файл разрешений ничего не разрешает');
  const seen = new Set();
  for (const entry of entries) {
    assert.match(entry.purl ?? '', /^pkg:npm\/.+@.+$/u, `purl без точной версии: ${entry.purl}`);
    assert.ok(!seen.has(entry.purl), `дубль записи: ${entry.purl}`);
    seen.add(entry.purl);
  }
});

test('каждая запись предъявляет источник и причину', () => {
  for (const entry of entries) {
    assert.match(entry.evidenceUrl ?? '', /^https:\/\//u, `нет источника: ${entry.purl}`);
    assert.ok(String(entry.reason ?? '').trim().length >= 40, `причина слишком коротка, чтобы быть причиной: ${entry.purl}`);
    assert.ok(String(entry.declaredLicense ?? '').trim().length > 0, `не объявлена лицензия: ${entry.purl}`);
  }
});

test('обязательство нельзя молча объявить пермиссивным', () => {
  for (const entry of entries) {
    const declared = entry.declaredLicense ?? '';
    if (!carriesObligation(declared)) continue;
    // Дизъюнкция — это право выбрать ветку; она закрывается выбором, а не решением о распространении.
    if (isDisjunction(declared) && entry.electedLicense && !carriesObligation(entry.electedLicense)) continue;

    assert.equal(
      entry.approvedNotPermissive,
      true,
      `${entry.purl}: лицензия ${declared} несёт обязательство, но запись не помечена как решение`,
    );
  }
});

test('каждое решение по обязательству называет обязательство, основание и то, что его удерживает', () => {
  const decisions = entries.filter((entry) => entry.approvedNotPermissive === true);
  assert.ok(decisions.length > 0, 'решений нет — проверять нечего, значит проверка сломана');
  for (const entry of decisions) {
    assert.ok(carriesObligation(entry.obligation), `${entry.purl}: obligation не назван или не является обязательством`);
    assert.ok(
      String(entry.distributionAnalysis ?? '').trim().length >= 80,
      `${entry.purl}: основание должно объяснять, почему обязательство не наступает, а не отсылать к слову «approved»`,
    );
    assert.ok(
      String(entry.enforcedBy ?? '').trim().length > 0,
      `${entry.purl}: решение без работающего гейта — обещание, а не доказательство`,
    );
  }
});

test('решение не выдаёт себя за факт: классификация проставлена явно', () => {
  for (const entry of entries) {
    if (entry.approvedNotPermissive !== true) continue;
    assert.ok(
      entry.classification === 'PERMISSIVE_OR_APPROVED' || entry.classification === 'PERMISSIVE_OR_APPROVED_DUAL_LICENSE',
      `${entry.purl}: у решения обязана стоять явная классификация`,
    );
  }
});

test('факт не выдаёт себя за решение', () => {
  for (const entry of entries) {
    if (entry.approvedNotPermissive === true) continue;
    if (carriesObligation(entry.declaredLicense)) continue;
    assert.equal(
      entry.obligation,
      undefined,
      `${entry.purl}: пермиссивная лицензия не может нести обязательство`,
    );
  }
});

test('то, что названо удерживающим, существует в репозитории', () => {
  for (const entry of entries) {
    if (!entry.enforcedBy) continue;
    assert.doesNotThrow(
      () => readFileSync(entry.enforcedBy, 'utf8'),
      `${entry.purl}: enforcedBy ссылается на несуществующий файл ${entry.enforcedBy}`,
    );
  }
});

test('признак обязательства не ловится на подстроке', () => {
  assert.equal(carriesObligation('MIT'), false);
  assert.equal(carriesObligation('Apache-2.0'), false);
  assert.equal(carriesObligation('NOTGPLISH-1.0'), false);
  assert.equal(carriesObligation('LGPL-3.0-or-later'), true);
  assert.equal(carriesObligation('MPL-2.0'), true);
  assert.equal(carriesObligation('CC-BY-4.0'), true);
});
