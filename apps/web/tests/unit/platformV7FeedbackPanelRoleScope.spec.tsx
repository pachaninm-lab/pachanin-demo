import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { GrainActionFeedbackPanel } from '@/components/platform-v7/GrainActionFeedbackPanel';
import { getGrainExecutionContext } from '@/lib/platform-v7/grain-execution/context';

afterEach(cleanup);

describe('GrainActionFeedbackPanel role scope', () => {
  it('driver does not see bank or money feedback and does not see support cases', () => {
    const ctx = getGrainExecutionContext();

    expect(ctx.supportActionFeedbackForRole('driver')).toHaveLength(0);
    expect(ctx.actionFeedbackPreviewsForRole('driver').every((item) => item.auditEvent.actorRole === 'driver')).toBe(true);

    render(<GrainActionFeedbackPanel role='driver' />);

    expect(screen.getByText('Действия по сделке')).toBeInTheDocument();
    expect(screen.getByText('Связанные обращения')).toBeInTheDocument();
    expect(screen.queryByText(/Внешнее банковое подтверждение/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Роль: банк/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Связь:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ответственный:/i)).not.toBeInTheDocument();
  });

  it('investor does not see operational support feedback', () => {
    const ctx = getGrainExecutionContext();

    expect(ctx.actionFeedbackPreviewsForRole('investor')).toHaveLength(0);
    expect(ctx.supportActionFeedbackForRole('investor')).toHaveLength(0);

    render(<GrainActionFeedbackPanel role='investor' />);

    expect(screen.getByText('Действия по сделке')).toBeInTheDocument();
    expect(screen.getByText('Связанные обращения')).toBeInTheDocument();
    expect(screen.queryByText(/^Связь:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Следующее действие:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ответственный:/i)).not.toBeInTheDocument();
  });

  it('bank sees money, document or dispute support feedback without field-role action leakage', () => {
    const ctx = getGrainExecutionContext();
    const bankCaseIds = new Set(ctx.supportActionFeedbackForRole('bank').map((feedback) => feedback.supportCaseId));
    const bankCases = ctx.supportCases.filter((supportCase) => bankCaseIds.has(supportCase.id));
    const hiddenFieldRoles = new Set(['driver', 'logistics', 'elevator', 'lab', 'investor']);

    expect(bankCases.length).toBeGreaterThan(0);
    expect(bankCases.every((supportCase) => ['money', 'documents', 'dispute'].includes(supportCase.category))).toBe(true);
    expect(ctx.actionFeedbackPreviewsForRole('bank').every((feedback) => !hiddenFieldRoles.has(feedback.auditEvent.actorRole))).toBe(true);
  });

  it('operator keeps the full feedback surface', () => {
    const ctx = getGrainExecutionContext();

    expect(ctx.actionFeedbackPreviewsForRole('operator')).toHaveLength(ctx.actionFeedbackPreviews.length);
    expect(ctx.supportActionFeedbackForRole('operator')).toHaveLength(ctx.supportActionFeedback.length);
  });

  it('logistics sees logistics-related support only', () => {
    const ctx = getGrainExecutionContext();
    const logisticsCaseIds = new Set(ctx.supportActionFeedbackForRole('logistics').map((feedback) => feedback.supportCaseId));
    const logisticsCases = ctx.supportCases.filter((supportCase) => logisticsCaseIds.has(supportCase.id));

    expect(logisticsCases.length).toBeGreaterThan(0);
    expect(
      logisticsCases.every(
        (supportCase) => supportCase.category === 'logistics' || supportCase.relatedEntityType === 'logistics_order',
      ),
    ).toBe(true);
  });
});
