import React from 'react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RoleExecutionCockpitPage } from '@/components/platform-v7/RoleExecutionCockpit';
import { OPERATIONAL_ROLE_EXECUTION_COCKPITS } from '@/lib/platform-v7/role-execution-cockpit';

const operationalRoles = ['logistics', 'driver', 'elevator', 'lab', 'surveyor', 'arbitrator', 'executive'] as const;

describe('platform-v7 operational role execution cockpit', () => {
  it('keeps operational roles on the shared title/status/fact/blocker/next/action grammar', () => {
    for (const role of operationalRoles) {
      const cockpit = OPERATIONAL_ROLE_EXECUTION_COCKPITS[role];

      expect(cockpit.role).toBe(role);
      expect(cockpit.title.length).toBeGreaterThan(10);
      expect(cockpit.kpis.length).toBeGreaterThanOrEqual(4);
      expect(cockpit.operations.length).toBeGreaterThanOrEqual(role === 'driver' ? 1 : 2);

      for (const operation of cockpit.operations) {
        expect(operation.title).toBeTruthy();
        expect(operation.status).toBeTruthy();
        expect(operation.shortFact).toBeTruthy();
        expect(operation.blocker).toBeTruthy();
        expect(operation.nextStep).toBeTruthy();
        expect(operation.action.label).toBeTruthy();
      }
    }
  });

  it('renders logistics with the shared light cockpit shell and concrete next actions', () => {
    render(<RoleExecutionCockpitPage cockpit={OPERATIONAL_ROLE_EXECUTION_COCKPITS.logistics} />);

    expect(screen.getByTestId('platform-v7-logistics-execution-cockpit')).toHaveAttribute('data-theme', 'light');
    expect(screen.getByText('Логистика · рейс → водитель → ЭТрН → приёмка')).toBeInTheDocument();
    expect(screen.getAllByText(/ЭТрН не закрыта грузополучателем/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /Открыть рейс водителя/i })).toHaveAttribute('href', '/platform-v7/driver/field');
  });

  it('keeps driver page source scoped to one field trip without cross-role language', () => {
    const source = readFileSync(path.join(process.cwd(), 'app/platform-v7/driver/field/page.tsx'), 'utf8');

    expect(OPERATIONAL_ROLE_EXECUTION_COCKPITS.driver.operations).toHaveLength(1);
    expect(OPERATIONAL_ROLE_EXECUTION_COCKPITS.driver.operations[0].action.label).toBe('Подтвердить прибытие');
    expect(source).not.toMatch(/банк|банков|деньг|инвестор|центр управления|control tower|другие сделки/i);
  });

  it('keeps the lab cabinet first screen inside the quality-protocol boundary', () => {
    const source = readFileSync(path.join(process.cwd(), 'app/platform-v7/lab/page.tsx'), 'utf8');

    expect(source).toContain('data-testid="platform-v7-lab-page"');
    expect(source).toContain('Лаборатория · качество и протокол');
    expect(source).toContain('Проба, показатели и протокол качества');
    expect(source).toContain('Финансовое решение, спор и банковская проверка остаются вне роли лаборатории');
    expect(source).toContain('Сорная примесь');
    expect(source).toContain('превышение требует протокола с допуском или отказом');
    expect(source).toContain('Протокол качества не выдан');
    expect(source).toContain('Пакет документов по качеству не закрыт');
    expect(source).toContain('Лабораторный runtime');
  });

  it('keeps the elevator cabinet first screen inside the receiving boundary', () => {
    const source = readFileSync(path.join(process.cwd(), 'app/platform-v7/elevator/page.tsx'), 'utf8');

    expect(source).toContain("data-testid='platform-v7-elevator-page'");
    expect(source).toContain('Кабинет приёмки');
    expect(source).toContain('Вес, качество и основание для проверки выплаты');
    expect(source).toContain('Отклонение веса -1,2 т');
    expect(source).toContain('Акт расхождения по весу не подписан');
    expect(source).toContain('Основание не передаётся банку');
    expect(source).toContain('Зафиксировать вес');
    expect(source).toContain('Передать пробу в лабораторию');
    expect(source).toContain('Runtime приёмки');
  });

  it('keeps the surveyor cabinet inside the independent evidence boundary', () => {
    const source = readFileSync(path.join(process.cwd(), 'app/platform-v7/surveyor/page.tsx'), 'utf8');

    expect(source).toContain('Независимая фиксация на площадке');
    expect(source).toContain('Осмотр, фото, расхождение и заключение');
    expect(source).toContain('фото, состояние груза, расхождения, замечания по приёмке и заключение');
    expect(source).toContain('Деньги, банк и решение спора остаются вне этой роли');
    expect(source).toContain('логистика → осмотр → оператор');
    expect(source).toContain('осмотр, фото, расхождение, акт');
    expect(source).toContain('/platform-v7/disputes');
    expect(source).toContain('Назначения на осмотр');
    expect(source).toContain('Требует акта');
  });

  it('keeps the arbitrator cabinet inside the dispute decision boundary', () => {
    const source = readFileSync(path.join(process.cwd(), 'app/platform-v7/arbitrator/page.tsx'), 'utf8');

    expect(source).toContain('platform-v7-arbitrator-decision-guard');
    expect(source).toContain('Арбитр · рамка решения');
    expect(source).toContain('Решение арбитра создаёт основание для ручной проверки');
    expect(source).toContain('сумму спора, доказательства, причину остановки и рекомендуемое действие');
    expect(source).toContain('ручной сверки основания оператором');
    expect(source).toContain('Акт расхождения DL-9102 не закрыт');
    expect(source).toContain('Удержание не снимается');
    expect(source).toContain('624 тыс. ₽');
    expect(source).toContain('Предынтеграционный контур · Арбитраж требует реальных договоров');
    expect(source).toContain('ArbitratorDisputeRoom');
  });
});
