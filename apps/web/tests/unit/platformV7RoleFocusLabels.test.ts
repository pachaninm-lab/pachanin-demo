import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8');

describe('platform-v7 premium role focus labels', () => {
  it('keeps role-specific focus visible in the premium status line', () => {
    const ui = read('apps/web/components/platform-v7/premium/ExecutionUi.tsx');

    expect(ui).toContain('const roleFocusLabels: Record<DealRole, string> = {');
    expect(ui).toContain("seller: 'получение денег и документы'");
    expect(ui).toContain("buyer: 'резерв, качество и приёмка'");
    expect(ui).toContain("logistics: 'рейс, сроки и доказательства'");
    expect(ui).toContain("driver: 'текущий рейс'");
    expect(ui).toContain("elevator: 'вес, приёмка и акт'");
    expect(ui).toContain("lab: 'качество и протокол'");
    expect(ui).toContain("surveyor: 'доказательства и расхождения'");
    expect(ui).toContain("bank: 'основания для выпуска денег'");
    expect(ui).toContain("arbiter: 'спор и доказательства'");
    expect(ui).toContain("compliance: 'документы и риск допуска'");
    expect(ui).toContain("operator: 'снятие блокеров сделки'");
    expect(ui).toContain("executive: 'деньги под риском и контроль'");
    expect(ui).toContain('{roleLabels[role]} · {roleFocusLabels[role]} · {balanceLabel}');
  });

  it('keeps driver field shell separate from premium role focus copy', () => {
    const ui = read('apps/web/components/platform-v7/premium/ExecutionUi.tsx');

    expect(ui).toContain("activeRole === 'driver'");
    expect(ui).toContain('return <DriverFieldShell task={deal.driverTask} theme={theme} />');
    expect(ui).toContain("driver: 'текущий рейс'");
  });
});
