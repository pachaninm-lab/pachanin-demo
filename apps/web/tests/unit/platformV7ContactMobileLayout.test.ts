import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('platform-v7 contact page mobile layout', () => {
  it('keeps contact form mobile-safe and compact', () => {
    const source = read('apps/web/app/platform-v7/contact/ContactClient.tsx');

    expect(source).toContain('calc(env(safe-area-inset-bottom) + 28px)');
    expect(source).toContain('@media(max-width:560px)');
    expect(source).toContain('grid-template-columns:1fr');
    expect(source).toContain('min-height:44px');
    expect(source).toContain('min-height:112px');
    expect(source).toContain('p7-contact-consent');
  });

  it('keeps the contact form as a request channel, not cabinet access', () => {
    const source = read('apps/web/app/platform-v7/contact/ContactClient.tsx');

    expect(source).toContain('Отправка обращения не открывает сделки, документы и закрытые разделы платформы.');
    expect(source).toContain("action='/api/platform-v7/inquiries'");
    expect(source).toContain("value='platform_v7_contact_page'");
  });
});
