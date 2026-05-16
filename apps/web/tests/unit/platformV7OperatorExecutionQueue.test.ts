import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  OPERATOR_QUEUE_ITEMS,
  getQueueItemsByPriority,
  getStopCount,
  getTotalMoneyAtRiskCount,
} from '../../lib/platform-v7/operator-execution-queue';
import { OperatorExecutionQueue } from '../../components/platform-v7/OperatorExecutionQueue';
import ControlTowerPage from '../../app/platform-v7/control-tower/page';
import OperatorPage from '../../app/platform-v7/operator/page';

const FORBIDDEN_PATTERNS = [
  'production-ready',
  'fully live',
  'live callback',
  'деньги переведены',
  'bypass impossible',
  'fully protected',
  'автоматически исполняется',
  'гарантирует',
  'ФГБУ ЦОК АПК',
];

function assertNoForbiddenWording(text: string) {
  for (const pattern of FORBIDDEN_PATTERNS) {
    expect(text.toLowerCase()).not.toContain(pattern.toLowerCase());
  }
  expect(text).not.toContain('/platform-v7/demo/');
}

describe('operator-execution-queue data', () => {
  it('has exactly 4 queue items', () => {
    expect(OPERATOR_QUEUE_ITEMS).toHaveLength(4);
  });

  it('every item has required fields', () => {
    for (const item of OPERATOR_QUEUE_ITEMS) {
      expect(item.id).toBeTruthy();
      expect(item.entityType).toBeTruthy();
      expect(item.entityId).toBeTruthy();
      expect(item.moneyAtRisk).toBeTruthy();
      expect(item.blocker).toBeTruthy();
      expect(item.ownerRole).toBeTruthy();
      expect(item.priority).toMatch(/^(stop|wait|info)$/);
      expect(item.slaLabel).toBeTruthy();
      expect(item.requiredAction).toBeTruthy();
      expect(item.safeNextAction).toBeTruthy();
      expect(item.whyNotExecutable).toBeTruthy();
      expect(item.href).toBeTruthy();
    }
  });

  it('has 3 stop-priority items and 1 wait-priority item', () => {
    expect(getQueueItemsByPriority('stop')).toHaveLength(3);
    expect(getQueueItemsByPriority('wait')).toHaveLength(1);
    expect(getQueueItemsByPriority('info')).toHaveLength(0);
  });

  it('getStopCount returns 3', () => {
    expect(getStopCount()).toBe(3);
  });

  it('getTotalMoneyAtRiskCount returns 4', () => {
    expect(getTotalMoneyAtRiskCount()).toBe(4);
  });

  it('DL-9106 items reference correct deals', () => {
    const dl9106Items = OPERATOR_QUEUE_ITEMS.filter((i) => i.entityId.includes('DL-9106'));
    expect(dl9106Items).toHaveLength(3);
  });

  it('DL-9102 item is present', () => {
    const dl9102 = OPERATOR_QUEUE_ITEMS.find((i) => i.entityId.includes('DL-9102'));
    expect(dl9102).toBeDefined();
    expect(dl9102!.priority).toBe('stop');
    expect(dl9102!.ownerRole).toBe('оператор');
  });

  it('every whyNotExecutable references the execution contour', () => {
    for (const item of OPERATOR_QUEUE_ITEMS) {
      expect(item.whyNotExecutable.toLowerCase()).toContain('контур исполнения');
    }
  });

  it('no forbidden wording in any field', () => {
    for (const item of OPERATOR_QUEUE_ITEMS) {
      const allText = [
        item.blocker,
        item.requiredAction,
        item.safeNextAction,
        item.whyNotExecutable,
        item.slaLabel,
      ].join(' ');
      assertNoForbiddenWording(allText);
    }
  });
});

describe('OperatorExecutionQueue component', () => {
  it('renders the queue container', () => {
    render(React.createElement(OperatorExecutionQueue));
    expect(screen.getByTestId('platform-v7-operator-execution-queue')).toBeDefined();
  });

  it('renders all 4 queue rows', () => {
    render(React.createElement(OperatorExecutionQueue));
    const rows = screen.getAllByTestId('platform-v7-operator-queue-row');
    expect(rows).toHaveLength(4);
  });

  it('renders stop count badge', () => {
    render(React.createElement(OperatorExecutionQueue));
    expect(screen.getByTestId('platform-v7-operator-queue-stop-count')).toBeDefined();
    expect(screen.getByTestId('platform-v7-operator-queue-stop-count').textContent).toContain('3');
  });

  it('renders priority chips', () => {
    render(React.createElement(OperatorExecutionQueue));
    const chips = screen.getAllByTestId('platform-v7-operator-queue-priority');
    expect(chips).toHaveLength(4);
    const stopChips = chips.filter((c) => c.textContent?.toLowerCase().includes('стоп'));
    expect(stopChips).toHaveLength(3);
  });

  it('renders blocker sections for each row', () => {
    render(React.createElement(OperatorExecutionQueue));
    const blockers = screen.getAllByTestId('platform-v7-operator-queue-blocker');
    expect(blockers).toHaveLength(4);
  });

  it('renders safe next action sections', () => {
    render(React.createElement(OperatorExecutionQueue));
    const safeNext = screen.getAllByTestId('platform-v7-operator-queue-safe-next');
    expect(safeNext).toHaveLength(4);
  });

  it('renders why-not-executable sections', () => {
    render(React.createElement(OperatorExecutionQueue));
    const whyNot = screen.getAllByTestId('platform-v7-operator-queue-why-not');
    expect(whyNot).toHaveLength(4);
  });

  it('renders execution contour and manual review label', () => {
    render(React.createElement(OperatorExecutionQueue));
    const container = screen.getByTestId('platform-v7-operator-execution-queue');
    expect(container.textContent).toContain('контур исполнения');
    expect(container.textContent).toContain('ручная проверка');
  });

  it('contains no forbidden wording in rendered output', () => {
    render(React.createElement(OperatorExecutionQueue));
    const container = screen.getByTestId('platform-v7-operator-execution-queue');
    assertNoForbiddenWording(container.textContent ?? '');
  });
});

describe('OperatorExecutionQueue page placement', () => {
  it('control tower page renders the operator queue without unsafe wording', () => {
    const { container } = render(React.createElement(ControlTowerPage));

    expect(screen.getByTestId('platform-v7-operator-execution-queue')).toBeDefined();
    assertNoForbiddenWording(container.textContent ?? '');
  });

  it('operator page renders the operator queue without unsafe wording', () => {
    const { container } = render(React.createElement(OperatorPage));

    expect(screen.getByTestId('platform-v7-operator-execution-queue')).toBeDefined();
    assertNoForbiddenWording(container.textContent ?? '');
  });
});
