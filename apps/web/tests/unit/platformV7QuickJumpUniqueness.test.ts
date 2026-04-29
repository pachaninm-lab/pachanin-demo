import { describe, expect, it } from 'vitest';
import { platformV7QuickJumpItems } from '@/lib/platform-v7/shellQuickJump';

describe('platform-v7 quick jump uniqueness', () => {
  it('keeps quick jump labels unique within each group', () => {
    const labelsByGroup = new Map<string, Set<string>>();

    for (const item of platformV7QuickJumpItems()) {
      const labels = labelsByGroup.get(item.group) ?? new Set<string>();
      const label = item.label.trim().toLowerCase();

      expect(labels.has(label)).toBe(false);
      labels.add(label);
      labelsByGroup.set(item.group, labels);
    }
  });

  it('keeps quick jump href and action pairs unique', () => {
    const keys = new Set<string>();

    for (const item of platformV7QuickJumpItems()) {
      const key = `${item.href}::${item.action ?? 'open'}`;

      expect(keys.has(key)).toBe(false);
      keys.add(key);
    }
  });
});
