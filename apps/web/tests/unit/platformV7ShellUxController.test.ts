import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const file = fs.readFileSync(path.join(process.cwd(), 'apps/web/components/platform-v7/PlatformV7ShellUxController.tsx'), 'utf8');

const roles = ['operator', 'buyer', 'seller', 'logistics', 'driver', 'surveyor', 'elevator', 'lab', 'bank', 'arbitrator', 'compliance', 'executive'];

function block(name: string, next: string) {
  return file.slice(file.indexOf(`${name}: [`), file.indexOf(`${next}: [`));
}

describe('PlatformV7ShellUxController', () => {
  it('has a home route for every role', () => {
    for (const role of roles) {
      expect(file).toContain(`${role}: '/platform-v7/`);
    }
  });

  it('logs out by clearing role state and returning to public entry', () => {
    expect(file).toContain('window.sessionStorage.removeItem(ACTIVE_ROLE_KEY)');
    expect(file).toContain('window.localStorage.removeItem(STORE_KEY)');
    expect(file).toContain("document.cookie = 'pc-role=; Max-Age=0; Path=/; SameSite=Lax'");
    expect(file).toContain("router.replace('/platform-v7')");
  });

  it('forces logo to public role-entry page, not login or role home', () => {
    expect(file).toContain("item.href = '/platform-v7'");
    expect(file).toContain('главная страница с описанием платформы и выбором роли');
    expect(file).not.toContain('item.href = roleHome');
  });

  it('hides legacy shell navigation and protects against horizontal overflow', () => {
    expect(file).toContain('.pc-v4-bottomnav{display:none!important}');
    expect(file).toContain('.pc-v4-switch-cabinet{display:none!important}');
    expect(file).toContain('.pc-v4-drawer .pc-v4-nav{display:none!important}');
    expect(file).toContain('.pc-v4-drawer > div:not(:first-child){display:none!important}');
    expect(file).toContain(".pc-v4-actions button[aria-label='Открыть уведомления']{display:none!important}");
    expect(file).toContain('overflow-x:hidden!important');
    expect(file).toContain('pc-v7-safe-drawer-nav');
  });

  it('uses role-specific dock with AI and optional menu', () => {
    expect(file).toContain('ROLE_FUNCTION_MAP');
    expect(file).toContain('showMenuButton');
    expect(file).toContain('hasExtraMenuItems');
    expect(file).not.toContain("action: 'signals'");
    expect(file).not.toContain("label: 'Сигналы'");
  });

  it('restores full seller function menu without leaving seller role', () => {
    const seller = block('seller', 'logistics');
    expect(seller).toContain("label: 'Партии'");
    expect(seller).toContain("label: 'Офферы'");
    expect(seller).toContain("label: 'Документы'");
    expect(seller).toContain("label: 'СДИЗ / ЭТрН'");
    expect(seller).toContain("label: 'Приёмка'");
    expect(seller).toContain("label: 'Деньги / резерв'");
    expect(seller).toContain("label: 'Блокеры'");
    expect(seller).not.toContain('/platform-v7/bank');
    expect(seller).not.toContain('/platform-v7/deals');
  });

  it('restores field role functions as same-cabinet anchors, not foreign cabinets', () => {
    const driver = block('driver', 'surveyor');
    const elevator = block('elevator', 'lab');
    const lab = block('lab', 'bank');
    expect(driver).toContain("label: 'Фото'");
    expect(driver).toContain("label: 'События'");
    expect(driver).toContain("label: 'Документы'");
    expect(driver).not.toContain('/platform-v7/deals');
    expect(driver).not.toContain('/platform-v7/bank');
    expect(elevator).toContain("label: 'Вес'");
    expect(elevator).toContain("label: 'Акты'");
    expect(elevator).not.toContain('/platform-v7/deals');
    expect(lab).toContain("label: 'Качество'");
    expect(lab).toContain("label: 'Протокол'");
    expect(lab).toContain("label: 'Повторный анализ'");
    expect(lab).not.toContain('/platform-v7/deals');
    expect(lab).not.toContain('/platform-v7/disputes');
  });

  it('keeps bank and executive access to real distinct routes', () => {
    const bank = block('bank', 'arbitrator');
    const executive = file.slice(file.indexOf('executive: ['), file.indexOf('};', file.indexOf('executive: [')));
    expect(bank).toContain("label: 'Факторинг'");
    expect(bank).toContain("label: 'Эскроу'");
    expect(bank).toContain("label: 'Документы'");
    expect(bank).toContain("label: 'Удержания'");
    expect(executive).toContain("label: 'Сводка'");
    expect(executive).toContain("label: 'Деньги'");
    expect(executive).toContain("label: 'Риски'");
  });

  it('renders role scoped notices instead of global notifications', () => {
    expect(file).toContain('NOTICES_BY_ROLE');
    expect(file).toContain('Уведомления роли');
    expect(file).toContain('pc-v7-notice-panel');
  });
});
