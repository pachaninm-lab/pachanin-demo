import React from 'react';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ElevatorPage from '@/app/platform-v7/elevator/page';

vi.mock('@/components/v7r/FieldElevatorRuntime', () => ({
  FieldElevatorRuntime: () => <div data-testid="field-elevator-runtime" />,
}));
vi.mock('@/components/platform-v7/RoleExecutionHandoff', () => ({
  RoleExecutionHandoff: () => <div data-testid="role-execution-handoff" />,
}));
vi.mock('@/components/platform-v7/EvidenceReadinessMiniMatrix', () => ({
  EvidenceReadinessMiniMatrix: () => <div data-testid="evidence-readiness-mini-matrix" />,
}));
vi.mock('@/components/platform-v7/DecisionRecommendationStrip', () => ({
  DecisionRecommendationStrip: () => <div data-testid="decision-recommendation-strip" />,
}));

const source = readFileSync(new URL('../../app/platform-v7/elevator/page.tsx', import.meta.url), 'utf8');

describe('platform-v7 elevator execution polish', () => {
  it('renders receiving screen with weight, quality and bank-review boundary', () => {
    render(<ElevatorPage />);

    expect(screen.getByText('Кабинет приёмки')).toBeInTheDocument();
    expect(screen.getByText(/Вес, качество и основание для проверки выплаты/i)).toBeInTheDocument();
    expect(screen.getByText(/основание для банковской проверки/i)).toBeInTheDocument();
    expect(screen.getByText(/Условия приёмки, влияющие на банковскую проверку/i)).toBeInTheDocument();
    expect(screen.getByText(/без акта основание не передаётся банку/i)).toBeInTheDocument();
    expect(screen.getByText(/Передача основания банку на проверку выплаты не продолжается/i)).toBeInTheDocument();
  });

  it('keeps elevator source free from direct payout and bank event wording', () => {
    expect(source).not.toMatch(/основание выплаты/);
    expect(source).not.toMatch(/выпуск денег продавцу/i);
    expect(source).not.toMatch(/банковского события/i);
    expect(source).not.toMatch(/без акта выплата невозможна/i);
    expect(source).not.toMatch(/платформа выпускает деньги/i);
    expect(source).not.toMatch(/деньги автоматически выпускаются/i);
    expect(source).not.toMatch(/production-ready/i);
    expect(source).not.toMatch(/fully live/i);
    expect(source).not.toMatch(/callback/i);
    expect(source).not.toMatch(/runtime/i);
  });
});
