import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const page = fs.readFileSync(path.join(process.cwd(), 'app/platform-v7/notifications/page.tsx'), 'utf8');

describe('notification single-purpose screen', () => {
  it('does not mount email templates or push configuration into the event list', () => {
    expect(page).not.toContain('EmailTemplatePreview');
    expect(page).not.toContain('PushNotificationManager');
  });
});
