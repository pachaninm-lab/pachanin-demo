import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  AI_IDENTITIES,
  AUTOMATION_NAMES,
  classifyTouch,
  contributorId,
  criticalityFor,
  summarize,
} from './build-ai-attribution.mjs';

const OWNER = 'pachaninm-lab#97bdb9e06bb3722c';
const CLAUDE = 'Claude#cd29c5ac348a026a';
const ACTIONS = 'github-actions[bot]#e7cd911927c7d1ac';

test('расчёт идентификатора совпадает со сборщиком чистой комнаты', () => {
  assert.equal(contributorId('pachaninm-lab', 'pachaninm@gmail.com'), OWNER);
  assert.equal(contributorId('Claude', 'noreply@anthropic.com'), CLAUDE);
  // Регистр адреса значения не имеет.
  assert.equal(contributorId('Claude', 'NoReply@Anthropic.com'), CLAUDE);
});

test('файл без истории не выдаётся за человеческий', () => {
  assert.equal(classifyTouch([]), 'NO_HISTORY');
  assert.equal(classifyTouch(undefined), 'NO_HISTORY');
});

test('классы различаются по существу, а не по количеству', () => {
  assert.equal(classifyTouch([OWNER]), 'HUMAN_ONLY');
  assert.equal(classifyTouch([CLAUDE]), 'AI_ONLY');
  assert.equal(classifyTouch([CLAUDE, OWNER]), 'AI_AND_HUMAN');
  assert.equal(classifyTouch([ACTIONS]), 'AUTOMATION_ONLY');
});

test('автоматика не считается человеком', () => {
  // Иначе любой файл, которого коснулся workflow, выглядел бы просмотренным человеком.
  assert.equal(classifyTouch([CLAUDE, ACTIONS]), 'AI_ONLY');
  assert.equal(classifyTouch([ACTIONS, 'root#ce3eaa797da1a69f']), 'AUTOMATION_ONLY');
});

test('каждый инструмент из списка распознаётся как AI', () => {
  for (const identity of AI_IDENTITIES) {
    assert.equal(classifyTouch([identity]), 'AI_ONLY', `не распознан как инструмент: ${identity}`);
  }
});

test('каждое имя из списка автоматики распознаётся', () => {
  for (const name of AUTOMATION_NAMES) {
    assert.equal(classifyTouch([`${name}#0123456789abcdef`]), 'AUTOMATION_ONLY', `не распознано как автоматика: ${name}`);
  }
});

test('незнакомая личность считается человеком, а не пропускается', () => {
  // Отказ в пользу осторожности: неизвестный автор — это человек, пока не доказано иное.
  assert.equal(classifyTouch(['Platon#af68b1a9b3724c86']), 'HUMAN_ONLY');
  assert.equal(classifyTouch(['Someone#0000000000000000', CLAUDE]), 'AI_AND_HUMAN');
});

test('критичность берётся по тому же правилу, что в build-ip-clean-room', () => {
  const roots = [
    { path: 'apps/api/src/modules/ledger' },
    { path: 'packages/design-system-v8', criticality: 'PROTECTED_PRODUCT_UI' },
  ];
  // Без поля criticality корень считается ядром.
  assert.equal(criticalityFor('apps/api/src/modules/ledger/ledger.service.ts', roots), 'CROWN_JEWEL');
  assert.equal(criticalityFor('apps/api/src/modules/ledger', roots), 'CROWN_JEWEL');
  // Объявленная критичность уважается.
  assert.equal(criticalityFor('packages/design-system-v8/src/index.ts', roots), 'PROTECTED_PRODUCT_UI');
  // Совпадение только по границе сегмента: соседний путь не захватывается.
  assert.equal(criticalityFor('apps/api/src/modules/ledger-v2/x.ts', roots), 'STANDARD');
  assert.equal(criticalityFor('apps/api/src/modules/other/x.ts', roots), 'STANDARD');
});

test('сводка считает aiTouched как сумму двух классов, а не одного', () => {
  const roots = [{ path: 'core' }];
  const files = [
    { path: 'core/a.ts', identities: [CLAUDE] },
    { path: 'core/b.ts', identities: [CLAUDE, OWNER] },
    { path: 'core/c.ts', identities: [OWNER] },
    { path: 'other/d.ts', identities: [CLAUDE] },
  ];
  const out = summarize(files, roots);
  assert.equal(out.CROWN_JEWEL.total, 3);
  assert.equal(out.CROWN_JEWEL.AI_ONLY, 1);
  assert.equal(out.CROWN_JEWEL.AI_AND_HUMAN, 1);
  assert.equal(out.CROWN_JEWEL.HUMAN_ONLY, 1);
  assert.equal(out.CROWN_JEWEL.aiTouched, 2, 'AI_ONLY без AI_AND_HUMAN занижает охват вдвое');
  assert.equal(out.STANDARD.total, 1);
});

test('счёт файлов ядра совпадает со сводкой чистой комнаты на том же коммите', () => {
  let attribution;
  let provenance;
  try {
    attribution = JSON.parse(readFileSync('artifacts/ip-clean-room/AI_ATTRIBUTION.json', 'utf8'));
    provenance = JSON.parse(readFileSync('artifacts/ip-clean-room/PROVENANCE_SUMMARY.json', 'utf8'));
  } catch {
    return; // Артефакты собираются в CI; без них проверять нечего.
  }
  // Сверять снимки с РАЗНЫХ коммитов бессмысленно: между ними меняется состав
  // файлов, и расхождение говорило бы о времени сборки, а не о расчёте.
  if (attribution.sourceSha !== provenance.gitHead) return;

  assert.equal(
    attribution.byCriticality?.CROWN_JEWEL?.total,
    provenance.crownJewelFiles,
    'в программе завелись два несогласованных счёта файлов ядра',
  );
  assert.equal(attribution.trackedFiles, provenance.trackedFiles);
});
