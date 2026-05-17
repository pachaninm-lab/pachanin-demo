import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8');

describe('platform-v7 offer-to-deal copy safety', () => {
  const pageSource = read('apps/web/app/platform-v7/offer-to-deal/page.tsx');

  it('does not expose startup or engineering language in the user-facing offer-to-deal page', () => {
    expect(pageSource).not.toContain('Deal Workspace');
    expect(pageSource).not.toContain('live bank adapter');
    expect(pageSource).not.toContain('Driver PWA');
    expect(pageSource).not.toContain('live tracking');
    expect(pageSource).not.toContain('gate/evidence');
    expect(pageSource).not.toContain('guard, toast, action log');
    expect(pageSource).not.toContain('money effect pending');
    expect(pageSource).not.toContain('rollback');
  });

  it('keeps the offer-to-deal bridge bank-safe and user-facing', () => {
    expect(pageSource).toContain('карточку сделки');
    expect(pageSource).toContain('без банковского решения и без движения денег');
    expect(pageSource).toContain('Банк должен отдельно подтвердить резерв');
    expect(pageSource).toContain('проверку условий, уведомление, журнал действий и отмену последнего шага');
    expect(pageSource).toContain('Проверить банковское основание');
  });

  it('does not imply platform-side payment release', () => {
    expect(pageSource).not.toContain('К выпуску');
    expect(pageSource).not.toContain('Выпущено');
    expect(pageSource).not.toContain('выпускает деньги');
    expect(pageSource).not.toContain('автоматическое платёжное обязательство');
    expect(pageSource).not.toContain('platform releases money');
    expect(pageSource).not.toContain('release funds');
  });
});
