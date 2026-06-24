import React from 'react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RoleExecutionCockpitPage } from '@/components/platform-v7/RoleExecutionCockpit';
import { OPERATIONAL_ROLE_EXECUTION_COCKPITS } from '@/lib/platform-v7/role-execution-cockpit';

const operationalRoles = ['logistics', 'driver', 'elevator', 'lab', 'surveyor', 'arbitrator', 'executive'] as const;

const platformActionTargetPattern = /^(\/platform-v7\/|#[a-z0-9-]+$)/;

const operationalRolePageFiles = [
  'app/platform-v7/logistics/page.tsx',
  'app/platform-v7/driver/field/page.tsx',
  'app/platform-v7/elevator/page.tsx',
  'app/platform-v7/lab/page.tsx',
  'app/platform-v7/surveyor/page.tsx',
  'app/platform-v7/arbitrator/page.tsx',
  'app/platform-v7/executive/page.tsx',
];

const unsupportedLiveReadinessClaims = [
  /готов[а-я\s-]*к промышленной эксплуатации/i,
  /production[-\s]?ready|live[-\s]?ready/i,
  /реальные интеграции подключены/i,
  /автоматическ[а-я\s-]*выплат[а-я\s-]*подключен[а-я]*/i,
  /боевой контур исполнения/i,
];

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

  it('keeps operational cockpit actions on explicit platform targets', () => {
    for (const role of operationalRoles) {
      const cockpit = OPERATIONAL_ROLE_EXECUTION_COCKPITS[role];

      for (const operation of cockpit.operations) {
        const { action } = operation;

        expect(action.label.trim().length).toBeGreaterThan(3);
        expect(action.href ?? '').toMatch(platformActionTargetPattern);
        expect(action.href ?? '').not.toMatch(/^javascript:|^mailto:|^tel:|^https?:|^#$/i);
      }
    }
  });

  it('keeps operational role pages honest about pre-integration readiness', () => {
    for (const file of operationalRolePageFiles) {
      const source = readFileSync(path.join(process.cwd(), file), 'utf8');

      for (const claim of unsupportedLiveReadinessClaims) {
        expect(source, `${file} must not claim unsupported live readiness: ${claim}`).not.toMatch(claim);
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

  it('keeps the logistics cabinet inside the route-document boundary', () => {
    const source = readFileSync(path.join(process.cwd(), 'app/platform-v7/logistics/page.tsx'), 'utf8');

    expect(source).toContain('Логистика · рейс → водитель → ЭТрН → приёмка');
    expect(source).toContain('План перевозки DL-9106');
    expect(source).toContain('исполнение: что логистика отправляет и ожидает');
    expect(source).toContain('ЭТрН ожидает подписи грузополучателя');
    expect(source).toContain('СДИЗ ожидает закрытия');
    expect(source).toContain('Плановый объём');
    expect(source).toContain('ГИС ЭПД');
    expect(source).toContain('/platform-v7/driver/field');
    expect(source).not.toMatch(/releaseMoney|approvePayment|confirmBank|выпустить деньги|создать акт расхождения/i);
  });

  it('keeps driver page source scoped to one field trip without cross-role language', () => {
    const source = readFileSync(path.join(process.cwd(), 'app/platform-v7/driver/field/page.tsx'), 'utf8');

    expect(OPERATIONAL_ROLE_EXECUTION_COCKPITS.driver.operations).toHaveLength(1);
    expect(OPERATIONAL_ROLE_EXECUTION_COCKPITS.driver.operations[0].action.label).toBe('Подтвердить прибытие');
    expect(source).not.toMatch(/банк|банков|деньг|инвестор|центр управления|control tower|другие сделки/i);
  });

  it('keeps the driver field cabinet inside the one-trip offline-evidence boundary', () => {
    const source = readFileSync(path.join(process.cwd(), 'app/platform-v7/driver/field/page.tsx'), 'utf8');

    expect(source).toContain('data-testid="platform-v7-driver-field-shell"');
    expect(source).toContain('Водитель · один рейс · одно действие');
    expect(source).toContain('Текущий рейс');
    expect(source).toContain('маршрут, связь, прибытие, фото, пломба и отклонение');
    expect(source).toContain('Подтвердить следующее действие по рейсу');
    expect(source).toContain('Связь / очередь');
    expect(source).toContain('Фото / пломба');
    expect(source).toContain('Статус рейса');
    expect(source).toContain('только свой рейс');
    expect(source).toContain('FieldDriverRuntime');
    expect(source).toContain('DriverMissionRouteCard');
    expect(source).not.toMatch(/releaseMoney|approvePayment|confirmBank|создать акт|выпустить деньги|портфель|BI/i);
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

  it('keeps the executive cabinet read-only and honest about operational control', () => {
    const source = readFileSync(path.join(process.cwd(), 'app/platform-v7/executive/page.tsx'), 'utf8');

    expect(source).toContain('Руководитель · только просмотр');
    expect(source).toContain('Исполнительная панель: деньги, споры, блокеры и портфель без права действия');
    expect(source).toContain('Деньги в блоке');
    expect(source).toContain('Главный блокер');
    expect(source).toContain('Банк ожидает');
    expect(source).toContain('Юнит-экономика (BI)');
    expect(source).toContain('из runtime-сделок');
    expect(source).toContain('Когда сделки появятся в контуре исполнения');
    expect(source).toContain('LiveApiStatusBar');
    expect(source).not.toMatch(/releaseMoney|approvePayment|confirmBank|создать акт|выпустить деньги/i);
  });
});
