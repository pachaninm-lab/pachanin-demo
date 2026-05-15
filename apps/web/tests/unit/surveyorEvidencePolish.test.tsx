import React from 'react';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SurveyorShellPage from '@/app/platform-v7/surveyor/page';

vi.mock('@/components/platform-v7/RoleExecutionSummary', () => ({
  RoleExecutionSummary: () => <div data-testid="role-execution-summary" />,
}));
vi.mock('@/app/platform-v7r/surveyor/page', () => ({
  default: () => <div data-testid="surveyor-runtime" />,
}));

const source = readFileSync(new URL('../../app/platform-v7/surveyor/page.tsx', import.meta.url), 'utf8');

describe('platform-v7 surveyor evidence polish', () => {
  it('renders independent evidence-focused surveyor screen', () => {
    render(<SurveyorShellPage />);

    expect(screen.getByText('Сюрвейер · осмотр → фото → расхождение → заключение')).toBeInTheDocument();
    expect(screen.getByText('Собрать независимые доказательства на площадке')).toBeInTheDocument();
    expect(screen.getByText(/осмотр, фото, состояние груза, расхождения, замечания и заключение/i)).toBeInTheDocument();
    expect(screen.getByText('Осмотр')).toBeInTheDocument();
    expect(screen.getByText('Расхождение')).toBeInTheDocument();
    expect(screen.getByText('Заключение')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Собрать доказательства/i })).toHaveAttribute('href', '/platform-v7/evidence-pack');
    expect(screen.getByText(/Доказательства неполные без фото и заключения/i)).toBeInTheDocument();
  });

  it('keeps surveyor source free from money, bank and dispute decision ownership', () => {
    expect(source).not.toMatch(/выплатить/i);
    expect(source).not.toMatch(/удержать/i);
    expect(source).not.toMatch(/к выплате/i);
    expect(source).not.toMatch(/платформа выпускает деньги/i);
    expect(source).not.toMatch(/банк подтверждает/i);
    expect(source).not.toMatch(/решить спор/i);
    expect(source).not.toMatch(/Центр управления/i);
    expect(source).not.toMatch(/production-ready/i);
    expect(source).not.toMatch(/fully live/i);
    expect(source).not.toMatch(/callback/i);
  });
});
