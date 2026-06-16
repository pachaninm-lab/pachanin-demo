import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const antiBypassSource = fs.readFileSync(path.join(process.cwd(), 'apps/web/app/platform-v7/anti-bypass/page.tsx'), 'utf8');
const workflowSource = fs.readFileSync(path.join(process.cwd(), 'apps/web/lib/platform-v7/workflow-source-of-truth.ts'), 'utf8');

describe('platform-v7 anti-bypass logic', () => {
  it('keeps public market visibility separated from contact disclosure', () => {
    expect(antiBypassSource).toContain('без контактов');
    expect(antiBypassSource).toContain('только в платформе');
    expect(antiBypassSource).toContain('обезличен');
    expect(antiBypassSource).toContain('Реальные контактные данные платформа не показывает');
  });

  it('keeps contact-leak action tied to masking, risk signal and operator control', () => {
    expect(workflowSource).toContain('Контактные данные замаскированы');
    expect(workflowSource).toContain('Сигнал передан в операторский контроль');
    expect(workflowSource).toContain('bypass_signal');
    expect(workflowSource).toContain('Контакт маскируется');
  });

  it('does not describe anti-bypass as automatic payment release', () => {
    expect(antiBypassSource).not.toContain('выпуска денег');
    expect(antiBypassSource).not.toContain('платформа гарантирует оплату');
    expect(antiBypassSource).toContain('проверки основания расчёта');
  });
});
