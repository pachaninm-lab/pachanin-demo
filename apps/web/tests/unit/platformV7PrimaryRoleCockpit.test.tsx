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

  it('wires primary pages to the shared cockpit component', () => {
    const files = [
      'apps/web/app/platform-v7/seller/page.tsx',
      'apps/web/app/platform-v7/buyer/page.tsx',
      'apps/web/app/platform-v7/bank/page.tsx',
      'apps/web/app/platform-v7/compliance/page.tsx',
      'apps/web/app/platform-v7/control-tower/page.tsx',
    ];

    for (const file of files) {
      const source = readFileSync(path.join(process.cwd(), file), 'utf8');
      expect(source).toMatch(/RoleExecutionCockpit(Page|Content)/);
      expect(source).toContain('PRIMARY_ROLE_EXECUTION_COCKPITS');
    }
  });
});
