import { describe, expect, it } from 'vitest';
import { platformV7NavItems } from '@/lib/platform-v7/navigation';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

const fieldRoles: PlatformRole[] = ['driver', 'elevator', 'lab', 'surveyor'];

describe('platform-v7 role navigation isolation', () => {
  it('keeps each field role menu limited to its own home screen', () => {
    for (const role of fieldRoles) {
      const items = platformV7NavItems(role);

      expect(items).toHaveLength(1);
      expect(items[0]?.href).toBe(`/platform-v7/${role}`);
    }
  });
});
