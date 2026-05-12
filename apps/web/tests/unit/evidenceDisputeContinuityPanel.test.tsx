import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { EvidenceDisputeContinuityPanel } from '@/components/v7r/EvidenceDisputeContinuityPanel';

describe('EvidenceDisputeContinuityPanel', () => {
  it('renders evidence, dispute, money and timeline continuity in user-facing Russian copy', () => {
    render(<EvidenceDisputeContinuityPanel />);

    const panel = screen.getByTestId('evidence-dispute-continuity-panel');
    expect(within(panel).getByText(/P0-05 · доказательства → спор → деньги · тестовый режим/)).toBeInTheDocument();
    expect(within(panel).getByText(/Доказательный пакет сделки/)).toBeInTheDocument();
    expect(within(panel).getByText('Доказательства')).toBeInTheDocument();
    expect(within(panel).getByText('Спорный контекст')).toBeInTheDocument();
    expect(within(panel).getByText('Журнал действий')).toBeInTheDocument();
    expect(within(panel).getByText('Лента сделки')).toBeInTheDocument();
  });

  it('explains money hold or release decision without live integration claims', () => {
    render(<EvidenceDisputeContinuityPanel />);

    const panel = screen.getByTestId('evidence-dispute-continuity-panel');
    expect(within(panel).getByText('Почему деньги удержаны или требуют проверки')).toBeInTheDocument();
    expect(within(panel).getByText(/Деньги удерживаются|Есть спорный след|Выплата ограничена|Спор не блокирует/)).toBeInTheDocument();
    expect(within(panel).getByText(/Это тестовый слой/)).toBeInTheDocument();
    expect(within(panel).getByText(/не вызывает боевые банковские, ФГИС или ЭДО-подключения/)).toBeInTheDocument();
  });

  it('renders dispute pack readiness score, checklist and test-mode export boundary', () => {
    render(<EvidenceDisputeContinuityPanel />);

    const readiness = screen.getByTestId('dispute-pack-readiness');
    expect(within(readiness).getByText('Готовность спорного пакета')).toBeInTheDocument();
    expect(within(readiness).getByText(/\d+% ·/)).toBeInTheDocument();
    expect(within(readiness).getByText('Доказательства прикреплены')).toBeInTheDocument();
    expect(within(readiness).getByText('Контекст спора')).toBeInTheDocument();
    expect(within(readiness).getByText('Журнал действий')).toBeInTheDocument();
    expect(within(readiness).getByText('Лента сделки связана')).toBeInTheDocument();
    expect(within(readiness).getByText('Решение по деньгам объяснено')).toBeInTheDocument();
    expect(within(readiness).getByText(/Сводка готова только для тестового просмотра/)).toBeInTheDocument();
    expect(within(readiness).getByText(/PDF\/ЭДО\/КЭП экспорт не заявлен как боевой/)).toBeInTheDocument();
  });

  it('does not expose technical English labels in the operational panel copy', () => {
    render(<EvidenceDisputeContinuityPanel />);

    const panelText = screen.getByTestId('evidence-dispute-continuity-panel').textContent || '';
    expect(panelText).not.toContain('sandbox');
    expect(panelText).not.toContain('simulation-only');
    expect(panelText).not.toContain('Evidence pack');
    expect(panelText).not.toContain('Bank decision');
    expect(panelText).not.toContain('Money hold / release');
    expect(panelText).not.toContain('Dispute pack readiness');
    expect(panelText).not.toContain('Audit trail');
    expect(panelText).not.toContain('Deal timeline');
  });

  it('shows human-readable evidence, dispute and journal values instead of raw system identifiers', () => {
    render(<EvidenceDisputeContinuityPanel />);

    const panelText = screen.getByTestId('evidence-dispute-continuity-panel').textContent || '';
    expect(panelText).toMatch(/Лабораторный протокол|Фотофиксация|Транспортный документ|Взвешивание|Приёмка/);
    expect(panelText).toMatch(/Расхождение качества|Расхождение веса|Расхождение документов|Срыв срока доставки/);
    expect(panelText).toMatch(/Продавец|Покупатель|Банк|Арбитр|Логистика|Водитель|Элеватор|Лаборатория|Сюрвейер|Комплаенс|Оператор|Система/);
    expect(panelText).not.toContain('lab_protocol');
    expect(panelText).not.toContain('quality_mismatch');
    expect(panelText).not.toContain('evidence_uploaded');
    expect(panelText).not.toContain('DISPUTE_OPEN');
  });

  it('links to deal, disputes and bank routes', () => {
    render(<EvidenceDisputeContinuityPanel />);

    const panel = screen.getByTestId('evidence-dispute-continuity-panel');
    expect(within(panel).getByRole('link', { name: 'Открыть сделку' })).toHaveAttribute('href', expect.stringContaining('/platform-v7/deals/'));
    expect(within(panel).getByRole('link', { name: 'Открыть споры' })).toHaveAttribute('href', '/platform-v7/disputes');
    expect(within(panel).getByRole('link', { name: 'Открыть банк' })).toHaveAttribute('href', '/platform-v7/bank');
  });
});
