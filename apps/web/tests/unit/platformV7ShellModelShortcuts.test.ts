import { describe, expect, it } from 'vitest';
import { platformV7ShellModel } from '@/lib/platform-v7/shell';
import { platformV7QuickJumpItems } from '@/lib/platform-v7/shellQuickJump';
import { platformV7ShortcutHelpItems } from '@/lib/platform-v7/shellShortcuts';

describe('platform-v7 shell model shortcuts', () => {
  it('exposes shortcut and quick jump registry entries', () => {
    const model = platformV7ShellModel('/platform-v7/control-tower', 'buyer');

    expect(model.shortcuts).toEqual(platformV7ShortcutHelpItems());
    expect(model.quickJumpEntries).toEqual(platformV7QuickJumpItems());
    expect(model.shortcuts.length).toBeGreaterThan(0);
    expect(model.quickJumpEntries.length).toBeGreaterThan(0);
  });

  it('keeps quick jump hrefs inside platform v7 route families', () => {
    const model = platformV7ShellModel('/platform-v7/control-tower', 'buyer');

    for (const entry of model.quickJumpEntries) {
      expect(entry.href.startsWith('/platform-v7')).toBe(true);
    }
  });
});
