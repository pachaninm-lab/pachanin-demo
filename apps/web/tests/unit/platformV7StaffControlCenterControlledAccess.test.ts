import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const staffPage = readFileSync(
  resolve(process.cwd(), 'app/platform-v7/staff/page.tsx'),
  'utf8',
);

describe('Staff Control Center controlled owner access', () => {
  it('verifies the signed controlled owner locally before depending on an external API hop', () => {
    expect(staffPage).toContain('verifyControlledIdentity(accessToken)');
    expect(staffPage).toContain("claims.testAccess !== true");
    expect(staffPage).toContain('staffOwner: owner');
    expect(staffPage).toContain('if (controlled) return controlled');
  });
});
