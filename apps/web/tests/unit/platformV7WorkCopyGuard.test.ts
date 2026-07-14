import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const files = [
  'apps/web/components/platform-v7/RoleAssistantWidget.tsx',
  'apps/web/components/platform-v7/RoleIntentDashboard.tsx',
  'apps/web/lib/platform-v7/shellRoutes.ts',
  'apps/web/app/platform-v7/control-tower/page.tsx',
];

const sources = files.map((file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8')).join('\n');
const bad = (...parts: string[]) => parts.join('');

describe('platform-v7 work copy guard', () => {
  it('keeps work UI on transaction execution language without runtime rewrites', () => {
    const forbidden = [
      bad('Де', 'мо-поток'),
      bad('Си', 'мулятор'),
      bad('Помо', 'щник роли'),
      bad('Giga', 'Chat'),
      bad('sand', 'box-only'),
      bad('нет ', 'аналогов'),
      bad('Shell', 'CopyNormalizer'),
      bad('NORMALIZED_', 'RUNTIME_COPY'),
    ];

    for (const term of forbidden) expect(sources).not.toContain(term);
  });

  it('uses mature work labels directly in canonical source code', () => {
    expect(sources).toContain('Разбор шага');
    expect(sources).toContain('Центр контроля');
    expect(sources).toContain('Остановки');
    expect(sources).not.toContain(bad('Control ', 'Tower'));
  });
});
