/**
 * Foundation smoke tests — §11 ТЗ v9.1
 * Criterion: AppShell renders, axe-violations = 0
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KpiCard } from '@/components/v9/cards/KpiCard';
import { Badge } from '@/components/v9/ui/badge';
import { Button } from '@/components/v9/ui/button';
import { EmptyState } from '@/components/v9/cards/EmptyState';
import { hasPermission, getNavItems, roleLabels } from '@/lib/v9/roles';
import { phases, getPhaseForStatus, getPhaseState } from '@/lib/v9/statuses';

// ──────────────────────────────────────────
// Button
// ──────────────────────────────────────────
describe('Button', () => {
  it('renders with primary variant', () => {
    render(<Button>Подтвердить</Button>);
    expect(screen.getByRole('button', { name: 'Подтвердить' })).toBeInTheDocument();
  });

  it('is disabled when loading=true', () => {
    render(<Button loading>Загрузка</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('applies danger variant class', () => {
    const { container } = render(<Button variant="danger">Удалить</Button>);
    expect(container.firstChild).toHaveClass('bg-danger');
  });
});

// ──────────────────────────────────────────
// Badge
// ──────────────────────────────────────────
describe('Badge', () => {
  it('renders children', () => {
    render(<Badge variant="success">OK</Badge>);
    expect(screen.getByText('OK')).toBeInTheDocument();
  });

  it('renders dot when dot=true', () => {
    const { container } = render(<Badge variant="danger" dot>Спор</Badge>);
    // There should be a dot span inside
    expect(container.querySelectorAll('span').length).toBeGreaterThan(1);
  });
});

// ──────────────────────────────────────────
// KpiCard
// ──────────────────────────────────────────
describe('KpiCard', () => {
  it('renders title and value', () => {
    render(<KpiCard title="Резерв" value="6.4 млн ₽" />);
    expect(screen.getByText('Резерв')).toBeInTheDocument();
    expect(screen.getByText('6.4 млн ₽')).toBeInTheDocument();
  });

  it('renders skeleton when loading=true', () => {
    const { container } = render(<KpiCard title="Test" value="—" loading />);
    expect(container.querySelectorAll('.v9-skeleton').length).toBeGreaterThan(0);
  });

  it('renders progress bar when progress provided', () => {
    render(<KpiCard title="Docs" value="80%" progress={80} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '80');
  });

  it('is clickable when onClick provided', () => {
    let clicked = false;
    render(<KpiCard title="Test" value="1" onClick={() => { clicked = true; }} />);
    screen.getByRole('button').click();
    expect(clicked).toBe(true);
  });
});

// ──────────────────────────────────────────
// EmptyState
// ──────────────────────────────────────────
describe('EmptyState', () => {
  it('renders title and description', () => {
    render(<EmptyState title="Нет данных" description="Создайте первую запись" />);
    expect(screen.getByText('Нет данных')).toBeInTheDocument();
    expect(screen.getByText('Создайте первую запись')).toBeInTheDocument();
  });

  it('has role=status for assistive technology', () => {
    render(<EmptyState title="Пусто" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});

// ──────────────────────────────────────────
// Roles — §4
// ──────────────────────────────────────────
describe('roles.ts — hasPermission', () => {
  it('operator can view deals', () => {
    expect(hasPermission('operator', 'deal.view')).toBe(true);
  });

  it('operator cannot approve release by default', () => {
    // Per matrix, operator has release.request but not release.approve
    expect(hasPermission('operator', 'release.approve')).toBe(false);
  });

  it('admin has all permissions', () => {
    expect(hasPermission('admin', 'deal.view')).toBe(true);
    expect(hasPermission('admin', 'release.approve')).toBe(true);
    expect(hasPermission('admin', 'dispute.resolve')).toBe(true);
    expect(hasPermission('admin', 'audit.view')).toBe(true);
  });

  it('driver can only field.submit and deal.view', () => {
    expect(hasPermission('driver', 'field.submit')).toBe(true);
    expect(hasPermission('driver', 'deal.view')).toBe(true);
    expect(hasPermission('driver', 'release.approve')).toBe(false);
    expect(hasPermission('driver', 'dispute.resolve')).toBe(false);
  });

  it('bank can approve release', () => {
    expect(hasPermission('bank', 'release.approve')).toBe(true);
  });
});

describe('roles.ts — getNavItems', () => {
  it('operator has control-tower nav item', () => {
    const items = getNavItems('operator');
    expect(items.some(i => i.href.includes('control-tower'))).toBe(true);
  });

  it('driver does not have bank nav item', () => {
    const items = getNavItems('driver');
    expect(items.some(i => i.href.includes('bank'))).toBe(false);
  });

  it('all roles have labels', () => {
    const roles = Object.keys(roleLabels) as Array<keyof typeof roleLabels>;
    roles.forEach(r => {
      expect(roleLabels[r]).toBeTruthy();
      expect(typeof roleLabels[r]).toBe('string');
    });
  });
});

// ──────────────────────────────────────────
// Statuses — §6.2
// ──────────────────────────────────────────
describe('statuses.ts', () => {
  it('maps quality_disputed to acceptance phase', () => {
    expect(getPhaseForStatus('quality_disputed')).toBe('acceptance');
  });

  it('maps closed to settlement phase', () => {
    expect(getPhaseForStatus('closed')).toBe('settlement');
  });

  it('phases cover all 17 statuses', () => {
    const allStatuses = phases.flatMap(p => p.steps);
    // Should have 17 unique statuses
    expect(new Set(allStatuses).size).toBe(17);
  });

  it('acceptance phase is blocked when status is quality_disputed', () => {
    const acceptancePhase = phases.find(p => p.id === 'acceptance')!;
    expect(getPhaseState(acceptancePhase, 'quality_disputed')).toBe('blocked');
  });

  it('contract phase is done when in_transit', () => {
    const contractPhase = phases.find(p => p.id === 'contract')!;
    expect(getPhaseState(contractPhase, 'in_transit')).toBe('done');
  });
});

// ──────────────────────────────────────────
// MSW integration — deals endpoint
// ──────────────────────────────────────────
describe('MSW — /api/deals', () => {
  it('returns 12 deals from fixture', async () => {
    const res = await fetch('/api/deals');
    const json = await res.json() as { data: unknown[]; total: number };
    expect(res.ok).toBe(true);
    expect(json.data.length).toBe(12);
    expect(json.total).toBe(12);
  });

  it('returns single deal by ID', async () => {
    const res = await fetch('/api/deals/DL-9102');
    const deal = await res.json() as { id: string; status: string };
    expect(deal.id).toBe('DL-9102');
    expect(deal.status).toBe('quality_disputed');
  });

  it('returns 404 for unknown deal', async () => {
    const res = await fetch('/api/deals/DL-9999');
    expect(res.status).toBe(404);
  });

  it('returns dispute DK-2024-89', async () => {
    const res = await fetch('/api/disputes/DK-2024-89');
    const dispute = await res.json() as { id: string; holdAmount: number };
    expect(dispute.id).toBe('DK-2024-89');
    expect(dispute.holdAmount).toBe(624000);
  });
});
