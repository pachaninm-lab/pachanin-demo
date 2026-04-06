import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildDeadlineProtection } from './deadline-protection';

describe('buildDeadlineProtection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-06T12:00:00Z'));
  });

  it('возвращает пустой результат для пустого массива', () => {
    const result = buildDeadlineProtection([]);
    expect(result.rows).toHaveLength(0);
    expect(result.summary.total).toBe(0);
    expect(result.summary.red).toBe(0);
  });

  it('помечает просроченный дедлайн как RED и overdue', () => {
    const result = buildDeadlineProtection([{
      id: 'test-1',
      title: 'Закрыть лабораторию',
      dueAt: '2026-04-06T10:00:00Z', // 2 часа назад
      requiredNow: 'close_lab',
    }]);
    expect(result.rows[0].state).toBe('RED');
    expect(result.rows[0].overdue).toBe(true);
    expect(result.rows[0].minutesLeft).toBeLessThan(0);
  });

  it('помечает дедлайн через 1 час как AMBER', () => {
    const result = buildDeadlineProtection([{
      id: 'test-2',
      title: 'Подтвердить отгрузку',
      dueAt: '2026-04-06T13:00:00Z', // через 1 час
      requiredNow: 'confirm_shipment',
    }]);
    expect(result.rows[0].state).toBe('AMBER');
    expect(result.rows[0].overdue).toBe(false);
  });

  it('помечает дедлайн через 5 часов как GREEN', () => {
    const result = buildDeadlineProtection([{
      id: 'test-3',
      title: 'Оплата',
      dueAt: '2026-04-06T18:00:00Z', // через 6 часов
      requiredNow: 'release_payment',
    }]);
    expect(result.rows[0].state).toBe('GREEN');
  });

  it('сортирует по срочности: RED первый', () => {
    const result = buildDeadlineProtection([
      { id: 'future', title: 'Оплата', dueAt: '2026-04-07T12:00:00Z', requiredNow: 'pay' },
      { id: 'overdue', title: 'Лаборатория', dueAt: '2026-04-06T08:00:00Z', requiredNow: 'close' },
      { id: 'soon', title: 'Отгрузка', dueAt: '2026-04-06T13:30:00Z', requiredNow: 'ship' },
    ]);
    expect(result.rows[0].id).toBe('overdue');
    expect(result.rows[1].id).toBe('soon');
    expect(result.rows[2].id).toBe('future');
  });

  it('сводка корректно считает RED/AMBER/GREEN', () => {
    const result = buildDeadlineProtection([
      { id: '1', title: 'A', dueAt: '2026-04-06T10:00:00Z', requiredNow: 'x' }, // RED (past)
      { id: '2', title: 'B', dueAt: '2026-04-06T13:00:00Z', requiredNow: 'x' }, // AMBER (<4h)
      { id: '3', title: 'C', dueAt: '2026-04-07T12:00:00Z', requiredNow: 'x' }, // GREEN (>4h)
    ]);
    expect(result.summary.red).toBe(1);
    expect(result.summary.amber).toBe(1);
    expect(result.summary.green).toBe(1);
    expect(result.summary.total).toBe(3);
    expect(result.summary.mostUrgent?.id).toBe('1');
  });

  it('использует deadlineAt как fallback для dueAt', () => {
    const result = buildDeadlineProtection([{
      id: 'alt',
      title: 'Fallback deadline',
      deadlineAt: '2026-04-06T10:00:00Z',
      requiredNow: 'action',
    }]);
    expect(result.rows[0].state).toBe('RED');
  });

  it('возвращает null для minutesLeft без дедлайна', () => {
    const result = buildDeadlineProtection([{
      id: 'no-date',
      title: 'Без дедлайна',
      requiredNow: 'something',
    }]);
    expect(result.rows[0].minutesLeft).toBeNull();
    expect(result.rows[0].state).toBe('GREEN');
    expect(result.rows[0].overdue).toBe(false);
  });
});
