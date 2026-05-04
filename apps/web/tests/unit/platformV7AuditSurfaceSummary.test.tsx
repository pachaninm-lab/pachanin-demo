import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuditSurfaceSummary } from '@/components/platform-v7/AuditSurfaceSummary';
import { getPlatformV7AuditSurface } from '@/components/platform-v7/AuditSurfaceSummaryGate';

describe('AuditSurfaceSummary', () => {
  it('renders the bank audit surface without fake payout language', () => {
    render(<AuditSurfaceSummary surface='bank' />);

    expect(screen.getByTestId('platform-v7-audit-surface-bank')).toBeInTheDocument();
    expect(screen.getAllByText('Банковский контур').length).toBeGreaterThan(0);
    expect(screen.getByText('нет фальшивой выплаты')).toBeInTheDocument();
    expect(screen.getByText(/выпуск не разрешён без СДИЗ, ЭТрН, УПД, акта, качества и закрытого спора/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Проверить условия выпуска' })).toHaveAttribute('href', '/platform-v7/bank');
  });

  it('renders the documents audit surface as a payout gate', () => {
    render(<AuditSurfaceSummary surface='documents' />);

    expect(screen.getByTestId('platform-v7-audit-surface-documents')).toBeInTheDocument();
    expect(screen.getAllByText('Документный контур').length).toBeGreaterThan(0);
    expect(screen.getByText(/источник → ответственный → статус → влияние на деньги/i)).toBeInTheDocument();
    expect(screen.getByText(/внутренняя карточка документа не заменяет ФГИС/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Открыть пакет документов' })).toHaveAttribute('href', '/platform-v7/documents');
  });

  it('renders the disputes audit surface with evidence and money impact', () => {
    render(<AuditSurfaceSummary surface='disputes' />);

    expect(screen.getByTestId('platform-v7-audit-surface-disputes')).toBeInTheDocument();
    expect(screen.getAllByText('Контур спора').length).toBeGreaterThan(0);
    expect(screen.getByText('доказательства до решения')).toBeInTheDocument();
    expect(screen.getByText(/сумма под риском связана с удержанием/i)).toBeInTheDocument();
    expect(screen.getByText(/спор нельзя закрыть без доказательного пакета/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Открыть споры' })).toHaveAttribute('href', '/platform-v7/disputes');
  });
});

describe('getPlatformV7AuditSurface', () => {
  it('maps bank, document and dispute routes to audit surfaces', () => {
    expect(getPlatformV7AuditSurface('/platform-v7/bank')).toBe('bank');
    expect(getPlatformV7AuditSurface('/platform-v7/bank/events/EVT-1')).toBe('bank');
    expect(getPlatformV7AuditSurface('/platform-v7/documents')).toBe('documents');
    expect(getPlatformV7AuditSurface('/platform-v7/disputes')).toBe('disputes');
    expect(getPlatformV7AuditSurface('/platform-v7/disputes/DSP-1')).toBe('disputes');
    expect(getPlatformV7AuditSurface('/platform-v7/seller')).toBeUndefined();
  });
});
