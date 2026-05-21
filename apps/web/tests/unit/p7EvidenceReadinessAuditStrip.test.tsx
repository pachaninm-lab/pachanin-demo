import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { P7EvidenceReadinessAuditStrip } from '@/components/platform-v7/P7EvidenceReadinessAuditStrip';

describe('P7EvidenceReadinessAuditStrip', () => {
  it('renders evidence readiness audit shell', () => {
    render(<P7EvidenceReadinessAuditStrip />);

    expect(screen.getByTestId('evidence-readiness-audit-strip')).toBeInTheDocument();
    expect(screen.getByText('Evidence readiness audit')).toBeInTheDocument();
    expect(screen.getByText('Controlled pilot · no live upload')).toBeInTheDocument();
  });

  it('renders ready and incomplete evidence rows', () => {
    render(<P7EvidenceReadinessAuditStrip />);

    const ready = screen.getByTestId('evidence-readiness-audit-row-ready');
    expect(within(ready).getByText('DK-2024-89')).toBeInTheDocument();
    expect(within(ready).getByText('Готов к разбору')).toBeInTheDocument();
    expect(within(ready).getByText('100% · 3/3 required')).toBeInTheDocument();
    expect(within(ready).getByText('Нет blockers')).toBeInTheDocument();

    const incomplete = screen.getByTestId('evidence-readiness-audit-row-incomplete');
    expect(within(incomplete).getByText('DK-2024-91')).toBeInTheDocument();
    expect(within(incomplete).getByText('Неполный пакет')).toBeInTheDocument();
    expect(within(incomplete).getByText('0% · 0/3 required')).toBeInTheDocument();
    expect(within(incomplete).getByText('• Не хватает обязательного evidence: lab_protocol')).toBeInTheDocument();
  });
});
