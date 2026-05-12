import React from 'react';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlatformV7DisputesPage from '@/app/platform-v7/disputes/page';

vi.mock('@/components/platform-v7/EvidenceDecisionPanel', () => ({
  EvidenceDecisionPanel: () => <div data-testid="evidence-decision-panel" />,
}));
vi.mock('@/components/platform-v7/EvidenceReadinessMiniMatrix', () => ({
  EvidenceReadinessMiniMatrix: () => <div data-testid="evidence-readiness-mini-matrix" />,
}));
vi.mock('@/components/platform-v7/DecisionRecommendationStrip', () => ({
  DecisionRecommendationStrip: () => <div data-testid="decision-recommendation-strip" />,
}));
vi.mock('@/components/platform-v7/DecisionPackMiniPanel', () => ({
  DecisionPackMiniPanel: () => <div data-testid="decision-pack-mini-panel" />,
}));
vi.mock('@/components/platform-v7/ActionFeedbackPreviewStrip', () => ({
  ActionFeedbackPreviewStrip: () => <div data-testid="action-feedback-preview-strip" />,
}));
vi.mock('@/components/platform-v7/RoleExecutionHandoff', () => ({
  RoleExecutionHandoff: () => <div data-testid="role-execution-handoff" />,
}));

const source = readFileSync(new URL('../../app/platform-v7/disputes/page.tsx', import.meta.url), 'utf8');

describe('platform-v7 disputes execution polish', () => {
  it('renders dispute execution screen with evidence and bank-boundary wording', () => {
    render(<PlatformV7DisputesPage />);

    expect(screen.getByText('Споры и удержания')).toBeInTheDocument();
    expect(screen.getByText(/Спор объясняет, почему сумма остановлена/i)).toBeInTheDocument();
    expect(screen.getByText('Банковская проверка')).toBeInTheDocument();
    expect(screen.getByText(/проверка выплаты остановлена/i)).toBeInTheDocument();
    expect(screen.getByText(/где проверка выплаты остановлена до качества/i)).toBeInTheDocument();
    expect(screen.getAllByText('держит сумму').length).toBeGreaterThan(0);
  });

  it('keeps disputes source free from direct payout control and overclaims', () => {
    expect(source).not.toMatch(/выплата остановлена/);
    expect(source).not.toMatch(/останавливает деньги/);
    expect(source).not.toMatch(/платформа выпускает деньги/i);
    expect(source).not.toMatch(/деньги автоматически выпускаются/i);
    expect(source).not.toMatch(/production-ready/i);
    expect(source).not.toMatch(/fully live/i);
    expect(source).not.toMatch(/callback/i);
    expect(source).not.toMatch(/runtime/i);
  });
});
