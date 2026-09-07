import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { renderSchedule, scheduleRows, SCHEDULE, USAGE } from './build-secret-rotation-schedule.mjs';

const usage = JSON.parse(readFileSync(USAGE, 'utf8'));

test('the committed schedule is what the generator produces from the register', () => {
  assert.equal(readFileSync(SCHEDULE, 'utf8'), renderSchedule(usage));
});

test('the schedule covers every secret in the register and invents none', () => {
  const secrets = usage.keys.filter((entry) => entry.kind === 'secret').map((entry) => entry.name).sort();
  const scheduled = scheduleRows(usage).map((entry) => entry.name).sort();
  assert.deepEqual(scheduled, secrets);

  const rendered = readFileSync(SCHEDULE, 'utf8');
  for (const name of secrets) assert.ok(rendered.includes(`\`${name}\``), `${name} is missing from the schedule`);

  // Configuration is not a secret and must not appear as one.
  for (const entry of usage.keys.filter((key) => key.kind !== 'secret')) {
    assert.ok(!rendered.includes(`\`${entry.name}\``), `${entry.name} is configuration, not a secret`);
  }
});

test('a secret whose rotation needs a data migration is never given a calendar date', () => {
  // The blind-index pepper cannot be changed without re-deriving every stored
  // index, and the phone key without re-encrypting every stored number. Printing
  // "every 90 days" next to either would be a schedule nobody can run.
  const rendered = readFileSync(SCHEDULE, 'utf8');
  for (const entry of scheduleRows(usage)) {
    if (entry.rotation.rotationSupport !== 'DATA_MIGRATION_REQUIRED') continue;
    const row = rendered.split('\n').find((line) => line.startsWith(`| \`${entry.name}\``));
    assert.ok(row, `${entry.name} has no row`);
    assert.match(row, /по событию/u);
    assert.doesNotMatch(row, /каждые \d+ дн\./u);
  }
});

test('the schedule states, for every secret, how it can actually be rotated', () => {
  const rendered = readFileSync(SCHEDULE, 'utf8');
  // Overlapping-key rotation is a real capability here and must be visible: the
  // bank callback registry already accepts several keys with validity windows, so
  // that secret can be rotated with no downtime at all.
  assert.match(rendered, /без простоя/u);
  assert.match(rendered, /требует миграции данных/u);
  for (const entry of scheduleRows(usage)) {
    assert.ok(rendered.includes(entry.rotation.rationale), `${entry.name} rationale is missing`);
  }
});
