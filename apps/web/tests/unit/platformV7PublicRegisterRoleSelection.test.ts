import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const patch = fs.readFileSync(path.join(process.cwd(), 'apps/web/components/platform-v7/PublicRegistrationEntryPatch.tsx'), 'utf8');
const registerPage = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/platform-v7/register/page.tsx'), 'utf8');

describe('platform-v7 public registration role selection', () => {
  it('routes public role cards into registration without opening cabinets', () => {
    expect(patch).toContain('roleRegistrationParams');
    expect(patch).toContain("'Продавец': 'seller'");
    expect(patch).toContain("'Покупатель': 'buyer'");
    expect(patch).toContain("tile.href = `/platform-v7/register?role=${role}`;");
    expect(patch).toContain("tile.dataset.entryRegister = 'role';");
    expect(patch).toContain("cta.textContent = 'Подать заявку на роль';");
  });

  it('keeps registration role choice as an application field, not a cabinet unlock', () => {
    expect(registerPage).toContain('RegisterSearchParams');
    expect(registerPage).toContain('ROLE_OPTIONS');
    expect(registerPage).toContain('getSelectedRole(searchParams)');
    expect(registerPage).toContain('defaultValue={selectedRole}');
    expect(registerPage).toContain('Выбор роли здесь не обходит role-lock');
  });
});
