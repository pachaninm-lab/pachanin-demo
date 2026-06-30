import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const files = [
  'apps/web/components/platform-v7/PlatformV7LeadCapture.tsx',
  'apps/web/components/platform-v7/PublicRegistrationEntryPatch.tsx',
  'apps/web/components/platform-v7/ContactCopyNormalizer.tsx',
  'apps/web/components/platform-v7/PublicHeroCopyNormalizer.tsx',
  'apps/web/app/platform-v7/register/page.tsx',
  'apps/web/app/platform-v7/docs/page.tsx',
].map((file) => [file, fs.readFileSync(path.join(process.cwd(), file), 'utf8')] as const);

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
  'Задать вопрос',
  'Посмотреть демо-сделку',
  'догонять сделку',
];

describe('platform-v7 public copy quality', () => {
  it('keeps public copy free of internal and artificial wording', () => {
    for (const [file, source] of files) {
      for (const phrase of banned) {
        expect(source, `${file} must not contain ${phrase}`).not.toContain(phrase);
      }
    }
  });

  it('keeps the three public actions distinct', () => {
    const actions = fs.readFileSync(path.join(process.cwd(), 'apps/web/components/platform-v7/PublicRegistrationEntryPatch.tsx'), 'utf8');
    expect(actions).toContain('Направить обращение');
    expect(actions).toContain('/platform-v7/contact');
    expect(actions).toContain('Оставить заявку');
    expect(actions).toContain('/platform-v7/request');
    expect(actions).toContain('Перейти к регистрации');
    expect(actions).toContain('/platform-v7/register');
  });
});
