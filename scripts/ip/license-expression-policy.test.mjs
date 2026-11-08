import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyLicenseExpression } from './license-expression-policy.mjs';

const cases = [
  ['MIT', 'PERMISSIVE_OR_APPROVED'],
  ['MIT-0', 'PERMISSIVE_OR_APPROVED'],
  ['MIT AND Zlib', 'PERMISSIVE_OR_APPROVED'],
  ['MIT OR GPL-3.0-only', 'PERMISSIVE_OR_APPROVED_DUAL_LICENSE'],
  ['MIT AND (GPL-3.0-only OR Apache-2.0)', 'PERMISSIVE_OR_APPROVED_DUAL_LICENSE'],
  ['MIT AND GPL-3.0-only', 'BLOCKED_STRONG_COPYLEFT_OR_SOURCE_AVAILABLE'],
  ['GPL-2.0-only OR AGPL-3.0-only', 'BLOCKED_STRONG_COPYLEFT_OR_SOURCE_AVAILABLE'],
  ['MPL-2.0', 'LEGAL_REVIEW'],
  ['MIT WITH unknown-exception', 'LEGAL_REVIEW'],
  ['LicenseRef-Proprietary', 'UNKNOWN_REVIEW'],
  ['SEE LICENSE IN LICENSE.txt', 'UNKNOWN_REVIEW'],
  ['MIT OR (Apache-2.0', 'UNKNOWN_REVIEW'],
];

for (const [expression, expected] of cases) {
  test(`${expression} => ${expected}`, () => {
    assert.equal(classifyLicenseExpression(expression), expected);
  });
}
