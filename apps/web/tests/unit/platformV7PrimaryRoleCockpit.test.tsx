import React from 'react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RoleExecutionCockpitPage } from '@/components/platform-v7/RoleExecutionCockpit';
import { PRIMARY_ROLE_EXECUTION_COCKPITS } from '@/lib/platform-v7/role-execution-cockpit';

const primaryRoles = ['seller', 'buyer', 'operator', 'bank', 'compliance'] as const;

describe('platform-v7 primary role execution cockpit', () => {
  it('keeps every primary role on the shared 5-second grammar', () => {
    for (const role of primaryRoles) {
      const cockpit = PRIMARY_ROLE_EXECUTION_COCKPITS[role];

      expect(cockpit.role).toBe(role);
      expect(cockpit.title.length).toBeGreaterThan(20);
      expect(cockpit.subtitle).toMatch(/документ|деньг|груз|качество|риск/i);
      expect(cockpit.kpis.length).toBeGreaterThanOrEqual(4);
      expect(cockpit.operations.length).toBeGreaterThanOrEqual(2);

      for (const operation of cockpit.operations) {
        expect(operation.title).toBeTruthy();
        expect(operation.status).toBeTruthy();
        expect(operation.shortFact).toBeTruthy();
        expect(operation.nextStep).toBeTruthy();
        expect(operation.action.label).toBeTruthy();
      }
    }
  });

  it('renders the bank cockpit with honest money boundary copy', () => {
    render(<RoleExecutionCockpitPage cockpit={PRIMARY_ROLE_EXECUTION_COCKPITS.bank} />);

    expect(screen.getByTestId('platform-v7-bank-execution-cockpit')).toHaveAttribute('data-theme', 'light');
    expect(screen.getByRole('heading', { level: 1, name: /Проверить основание/i })).toBeInTheDocument();
    expect(screen.getByText(/Платформа не двигает деньги сама/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Проверить деньги/i })).toHaveAttribute('href', '/platform-v7/bank/release-safety');
  });

  it('wires primary pages to an explicit cockpit marker or shared cockpit component', () => {
    const files = [
      { file: 'app/platform-v7/seller/page.tsx', marker: 'data-platform-v7-seller-cockpit-pass' },
      { file: 'app/platform-v7/buyer/page.tsx', marker: 'data-platform-v7-buyer-cockpit-pass' },
      { file: 'app/platform-v7/bank/page.tsx', marker: 'data-platform-v7-bank-cockpit-pass' },
      { file: 'app/platform-v7/compliance/page.tsx', marker: 'data-platform-v7-compliance-cockpit-pass' },
      { file: 'app/platform-v7/control-tower/page.tsx', marker: "testId='platform-v7-control-tower-page'" },
    ];

    for (const { file, marker } of files) {
      const source = readFileSync(path.join(process.cwd(), file), 'utf8');
      expect(source).toContain(marker);
    }
  });

  it('keeps the buyer cabinet first screen on a real control contract', () => {
    const source = readFileSync(path.join(process.cwd(), 'app/platform-v7/buyer/page.tsx'), 'utf8');

    expect(source).toContain('buyerFirstScreenFacts');
    expect(source).toContain('Что произошло');
    expect(source).toContain('Что блокирует');
    expect(source).toContain('Деньги под риском');
    expect(source).toContain('Ответственный');
    expect(source).toContain('Следующий шаг');
    expect(source).toContain('банк ещё не подтвердил резерв');
    expect(source).toContain('/platform-v7/deals/DL-9106/money');
    expect(source).toContain('платформа показывает причину, деньги и маршрут');
    expect(source).toContain('Банковское подтверждение обязательно для передачи средств');
  });

  it('keeps the bank cabinet first screen on an honest money boundary', () => {
    const source = readFileSync(path.join(process.cwd(), 'app/platform-v7/bank/page.tsx'), 'utf8');

    expect(source).toContain('data-platform-v7-bank-cockpit-pass');
    expect(source).toContain('Сначала основание, потом банковская проверка');
    expect(source).toContain('Деньги не двигаются, пока нет основания');
    expect(source).toContain('Что блокирует');
    expect(source).toContain('СДИЗ, ЭТрН, УПД, акт, качество');
    expect(source).toContain('Кто следующий');
    expect(source).toContain('оператор + ответственный за документ');
    expect(source).toContain('/platform-v7/bank/release-safety');
    expect(source).toContain('Нет заявления о выплате без банковского подтверждения');
  });

  it('keeps the compliance cabinet first screen on an explicit risk-admission boundary', () => {
    const source = readFileSync(path.join(process.cwd(), 'app/platform-v7/compliance/page.tsx'), 'utf8');

    expect(source).toContain('data-platform-v7-compliance-cockpit-pass');
    expect(source).toContain('допуск → риск → документы → решение');
    expect(source).toContain('контрагент ждёт ручного допуска');
    expect(source).toContain('сделка не двигается до решения по допуску');
    expect(source).toContain('Контрагента на проверке');
    expect(source).toContain('Стоп-фактор риска');
    expect(source).toContain('Ручной допуск и риск');
    expect(source).toContain('Комплаенс runtime и проверки');
  });
});
