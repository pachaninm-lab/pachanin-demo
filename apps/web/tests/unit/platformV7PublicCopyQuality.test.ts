import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const files = [
  'apps/web/components/platform-v7/PlatformV7LeadCapture.tsx',
  'apps/web/components/platform-v7/PublicRegistrationEntryPatch.tsx',
  'apps/web/components/platform-v7/ContactCopyNormalizer.tsx',
  'apps/web/components/platform-v7/PublicHeroCopyNormalizer.tsx',
  'apps/web/app/platform-v7/open/page.tsx',
  'apps/web/app/platform-v7/register/page.tsx',
  'apps/web/app/platform-v7/docs/page.tsx',
  'apps/web/lib/platform-v7/shellRoutes.ts',
].map((file) => [file, fs.readFileSync(path.join(process.cwd(), file), 'utf8')] as const);

// Public-facing copy must stay free of internal jargon and of maturity
// over-claiming. (Operational role-nav labels such as "Блокеры" are legitimate
// product vocabulary and are intentionally not banned.)
const banned = [
  'controlled pilot',
  'pre-integration',
  'CRM-контур',
  'лид',
  'автоответ',
  'этот ЛК',
  'заявка регистрируется',
  'контакт используется для ответа',
  'доступ к рабочим данным не предоставляется',
  'Посмотреть демо-сделку',
  'догонять сделку',
];

describe('platform-v7 public copy quality', () => {
  it('keeps public copy and role navigation free of internal and artificial wording', () => {
    for (const [file, source] of files) {
      for (const phrase of banned) {
        expect(source, `${file} must not contain ${phrase}`).not.toContain(phrase);
      }
    }
  });

  it('exposes distinct public registration entry points', () => {
    const actions = fs.readFileSync(path.join(process.cwd(), 'apps/web/components/platform-v7/PublicRegistrationEntryPatch.tsx'), 'utf8');
    // The patch injects registration entry points on the public shell: a header
    // link, a hero CTA and per-role application links — all to /platform-v7/register.
    expect(actions).toContain('/platform-v7/register');
    expect(actions).toContain('Регистрация');
    expect(actions).toContain('Зарегистрироваться');
    expect(actions).toContain('Подать заявку на роль');
  });

  it('keeps the public deal-path CTA visible and anchored to the process block', () => {
    const actions = fs.readFileSync(path.join(process.cwd(), 'apps/web/components/platform-v7/PublicRegistrationEntryPatch.tsx'), 'utf8');
    expect(actions).toContain('Посмотреть путь сделки');
    expect(actions).toContain("routeLink.href = '#process'");
  });

  it('keeps protected role navigation understandable', () => {
    const routes = fs.readFileSync(path.join(process.cwd(), 'apps/web/lib/platform-v7/shellRoutes.ts'), 'utf8');
    // Role navigation uses plain human labels, not codes or English jargon.
    for (const label of ['Сделки', 'Документы', 'Деньги', 'Партии', 'Блокеры']) {
      expect(routes).toContain(label);
    }
  });
});
