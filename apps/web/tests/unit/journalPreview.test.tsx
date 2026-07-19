import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { JournalPreview } from '@/components/platform-v7/JournalPreview';
import { getJournalPreviewEntries } from '@/lib/platform-v7/journal-preview';
import SellerPage from '@/app/platform-v7/seller/page';
import BuyerPage from '@/app/platform-v7/buyer/page';
import BankPage from '@/app/platform-v7/bank/page';

describe('getJournalPreviewEntries', () => {
  it('returns entries for seller role', () => {
    const entries = getJournalPreviewEntries('seller');
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.length).toBeLessThanOrEqual(3);
  });

  it('returns entries for buyer role', () => {
    const entries = getJournalPreviewEntries('buyer');
    expect(entries.length).toBeGreaterThan(0);
  });

  it('returns entries for bank role', () => {
    const entries = getJournalPreviewEntries('bank');
    expect(entries.length).toBeGreaterThan(0);
  });

  it('respects maxEntries=1', () => {
    expect(getJournalPreviewEntries('seller', 1)).toHaveLength(1);
    expect(getJournalPreviewEntries('buyer', 1)).toHaveLength(1);
    expect(getJournalPreviewEntries('bank', 1)).toHaveLength(1);
  });

  it('returns empty array when maxEntries=0', () => {
    expect(getJournalPreviewEntries('seller', 0)).toHaveLength(0);
  });

  it('all entries have required fields', () => {
    for (const role of ['seller', 'buyer', 'bank'] as const) {
      for (const entry of getJournalPreviewEntries(role, 10)) {
        expect(entry.id).toBeTruthy();
        expect(entry.objectId).toBeTruthy();
        expect(entry.action).toBeTruthy();
        expect(entry.message).toBeTruthy();
        expect(entry.actor).toBeTruthy();
        expect(entry.at).toBeTruthy();
        expect(['started', 'success', 'error']).toContain(entry.status);
      }
    }
  });
});

describe('JournalPreview component', () => {
  it('renders with testid and role attribute', () => {
    render(<JournalPreview role='seller' />);
    const el = screen.getByTestId('journal-preview');
    expect(el).toBeInTheDocument();
    expect(el).toHaveAttribute('data-role', 'seller');
  });

  it('renders section label with контур исполнения wording', () => {
    const { container } = render(<JournalPreview role='seller' />);
    expect(container.innerHTML).toContain('контур исполнения');
  });

  it('renders entries with data-testid journal-preview-entry', () => {
    render(<JournalPreview role='seller' maxEntries={3} />);
    const entries = screen.getAllByTestId('journal-preview-entry');
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.length).toBeLessThanOrEqual(3);
  });

  it('respects maxEntries prop', () => {
    render(<JournalPreview role='bank' maxEntries={1} />);
    expect(screen.getAllByTestId('journal-preview-entry')).toHaveLength(1);
  });

  it('renders empty state message when maxEntries=0', () => {
    render(<JournalPreview role='seller' maxEntries={0} />);
    expect(screen.getByText('События пока не зафиксированы.')).toBeInTheDocument();
    expect(screen.queryByTestId('journal-preview-entry')).not.toBeInTheDocument();
  });

  it('seller entries include контур исполнения wording', () => {
    const { container } = render(<JournalPreview role='seller' />);
    expect(container.innerHTML).toContain('контур исполнения');
  });

  it('buyer entries include банковское подтверждение wording', () => {
    render(<JournalPreview role='buyer' />);
    expect(screen.getByText(/банковское подтверждение/)).toBeInTheDocument();
  });

  it('bank entries include банковское событие wording', () => {
    render(<JournalPreview role='bank' />);
    expect(screen.getByText(/банковское событие/)).toBeInTheDocument();
  });

  it('bank entry with error shows причина остановки', () => {
    render(<JournalPreview role='bank' maxEntries={3} />);
    expect(screen.getByText(/причина остановки/)).toBeInTheDocument();
  });

  it('entries carry data-status attribute matching entry status', () => {
    render(<JournalPreview role='bank' maxEntries={3} />);
    const entries = screen.getAllByTestId('journal-preview-entry');
    const statuses = entries.map((el) => el.getAttribute('data-status'));
    expect(statuses).toContain('success');
    expect(statuses).toContain('started');
    expect(statuses).toContain('error');
  });

  it('entries carry data-object attribute with object id', () => {
    render(<JournalPreview role='seller' />);
    const entries = screen.getAllByTestId('journal-preview-entry');
    for (const entry of entries) {
      expect(entry.getAttribute('data-object')).toBeTruthy();
    }
  });

  it('does not contain forbidden overclaim copy', () => {
    for (const role of ['seller', 'buyer', 'bank'] as const) {
      const { container } = render(<JournalPreview role={role} />);
      const html = container.innerHTML;
      expect(html).not.toMatch(/production-ready/i);
      expect(html).not.toMatch(/fully live/i);
      expect(html).not.toMatch(/платформа гарантирует оплату/i);
      expect(html).not.toMatch(/деньги переведены/i);
      expect(html).not.toMatch(/выплата выполнена/i);
    }
  });

  it('does not expose stale release or bid wording', () => {
    for (const role of ['seller', 'buyer', 'bank'] as const) {
      const entries = getJournalPreviewEntries(role, 10);
      const text = entries.map((entry) => `${entry.id}\n${entry.action}\n${entry.message}\n${entry.error ?? ''}`).join('\n').toLowerCase();
      expect(text).not.toContain('ставка');
      expect(text).not.toContain('release');
      expect(text).not.toContain('выплата остановлена');
    }
  });

  it('does not link to /platform-v7/demo/', () => {
    for (const role of ['seller', 'buyer', 'bank'] as const) {
      const { container } = render(<JournalPreview role={role} />);
      const links = container.querySelectorAll('a[href*="/platform-v7/demo/"]');
      expect(links.length).toBe(0);
    }
  });
});

describe('JournalPreview on role pages', () => {
  it('seller page renders journal-preview section', async () => {
    render(await SellerPage());
    expect(screen.getByTestId('journal-preview')).toBeInTheDocument();
    expect(screen.getByTestId('journal-preview')).toHaveAttribute('data-role', 'seller');
  });

  it('buyer page renders journal-preview section', async () => {
    render(await BuyerPage());
    expect(screen.getByTestId('journal-preview')).toBeInTheDocument();
    expect(screen.getByTestId('journal-preview')).toHaveAttribute('data-role', 'buyer');
  });

  it('bank page renders journal-preview section', async () => {
    render(await BankPage());
    expect(screen.getByTestId('journal-preview')).toBeInTheDocument();
    expect(screen.getByTestId('journal-preview')).toHaveAttribute('data-role', 'bank');
  });

  it('seller page journal entries are role-specific (seller objects)', async () => {
    render(await SellerPage());
    const preview = screen.getByTestId('journal-preview');
    expect(preview.innerHTML).toContain('BAT-2403');
  });

  it('buyer page journal has банковское подтверждение wording', async () => {
    render(await BuyerPage());
    const preview = screen.getByTestId('journal-preview');
    expect(preview.innerHTML).toContain('банковское подтверждение');
  });

  it('bank page journal has банковское событие wording', async () => {
    render(await BankPage());
    const preview = screen.getByTestId('journal-preview');
    expect(preview.innerHTML).toContain('банковское событие');
  });
});
