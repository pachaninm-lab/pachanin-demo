import React from 'react';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import LabPage from '@/app/platform-v7/lab/page';

vi.mock('@/components/platform-v7/RoleExecutionSummary', () => ({
  RoleExecutionSummary: () => <div data-testid="role-execution-summary" />,
}));
vi.mock('@/components/v7r/FieldLabRuntime', () => ({
  FieldLabRuntime: () => <div data-testid="field-lab-runtime" />,
}));
vi.mock('@/components/v7r/RoleContinuityPanel', () => ({
  RoleContinuityPanel: () => <div data-testid="role-continuity-panel" />,
}));

const source = readFileSync(new URL('../../app/platform-v7/lab/page.tsx', import.meta.url), 'utf8');

describe('platform-v7 lab quality polish', () => {
  it('renders quality-only lab screen with sample, indicators and protocol', () => {
    render(<LabPage />);

    expect(screen.getByText('Лаборатория как доказательство качества')).toBeInTheDocument();
    expect(screen.getByText('Проба, показатели и протокол качества')).toBeInTheDocument();
    expect(screen.getByText(/показатели качества, отклонения и итоговый допуск/i)).toBeInTheDocument();
    expect(screen.getByText('Проба')).toBeInTheDocument();
    expect(screen.getByText('Показатели')).toBeInTheDocument();
    expect(screen.getByText('Отклонение')).toBeInTheDocument();
    expect(screen.getByText('Протокол')).toBeInTheDocument();
    expect(screen.getByText(/основание уходит в контур документов/i)).toBeInTheDocument();
  });

  it('keeps lab source free from money, bank and dispute action ownership', () => {
    expect(source).not.toMatch(/выплатить/i);
    expect(source).not.toMatch(/удержать/i);
    expect(source).not.toMatch(/к выплате/i);
    expect(source).not.toMatch(/платформа выпускает деньги/i);
    expect(source).not.toMatch(/деньги автоматически выпускаются/i);
    expect(source).not.toMatch(/банк подтверждает/i);
    expect(source).not.toMatch(/решить спор/i);
    expect(source).not.toMatch(/production-ready/i);
    expect(source).not.toMatch(/fully live/i);
    expect(source).not.toMatch(/callback/i);
    expect(source).not.toMatch(/runtime/i);
  });
});
