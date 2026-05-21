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
      expect(cockpit.title.length).toBeGreaterThan(18);
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
    expect(screen.getByText(/ЭТрН не закрыта грузополучателем/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Открыть рейс водителя/i })).toHaveAttribute('href', '/platform-v7/driver/field');
  });

  it('keeps driver page source scoped to one field trip without cross-role language', () => {
    const source = readFileSync(path.join(process.cwd(), 'apps/web/app/platform-v7/driver/field/page.tsx'), 'utf8');

    expect(OPERATIONAL_ROLE_EXECUTION_COCKPITS.driver.operations).toHaveLength(1);
    expect(OPERATIONAL_ROLE_EXECUTION_COCKPITS.driver.operations[0].action.label).toBe('Подтвердить прибытие');
    expect(source).not.toMatch(/банк|банков|деньг|инвестор|центр управления|control tower|другие сделки/i);
  });
});
