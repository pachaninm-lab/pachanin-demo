import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { RoleExecutionCockpitContent } from '@/components/platform-v7/RoleExecutionCockpit';
import { PRIMARY_ROLE_EXECUTION_COCKPITS, OPERATIONAL_ROLE_EXECUTION_COCKPITS } from '@/lib/platform-v7/role-execution-cockpit';

const contractLabels = ['Статус', 'Блокер', 'Главное действие', 'Деньги', 'Документы / evidence'];

const cockpits = {
  ...PRIMARY_ROLE_EXECUTION_COCKPITS,
  ...OPERATIONAL_ROLE_EXECUTION_COCKPITS,
};

describe('platform-v7 role screen contract strip', () => {
  it('renders the first decision layer before role KPI and operation grids', () => {
    render(<RoleExecutionCockpitContent cockpit={PRIMARY_ROLE_EXECUTION_COCKPITS.seller} />);

    const contract = screen.getByTestId('platform-v7-seller-screen-contract');
    const kpis = screen.getByTestId('platform-v7-seller-kpis');
    const operations = screen.getByTestId('platform-v7-seller-operations');

    expect(contract.compareDocumentPosition(kpis) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(kpis.compareDocumentPosition(operations) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    for (const label of contractLabels) {
      expect(within(contract).getByText(label)).toBeInTheDocument();
    }
  });

  it('gives every role a status, blocker, primary action, money impact and documents/evidence summary', () => {
    for (const cockpit of Object.values(cockpits)) {
      render(<RoleExecutionCockpitContent cockpit={cockpit} />);
      const contract = screen.getByTestId(`platform-v7-${cockpit.role}-screen-contract`);

      for (const label of contractLabels) {
        expect(within(contract).getByText(label), `${cockpit.role}: missing ${label}`).toBeInTheDocument();
      }

      expect(contract.textContent ?? '').not.toMatch(/production-ready|fully live|fully integrated|guarantees payment|releases money/i);
    }
  });
});
