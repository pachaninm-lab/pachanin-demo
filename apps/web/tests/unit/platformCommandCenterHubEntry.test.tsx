import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlatformCommandCenterHub } from '@/components/v7r/PlatformCommandCenterHub';

describe('platform-v7 command center entry', () => {
  it('renders the execution entry with bank-boundary wording', () => {
    const { container } = render(<PlatformCommandCenterHub />);
    const text = container.textContent || '';

    expect(container.querySelector('main[data-role="operator"][data-theme="light"]')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Пшеница 4 класс · LOT-2403' })).toBeInTheDocument();
    expect(screen.getByText('DL-9106')).toBeInTheDocument();
    expect(screen.getAllByText('Запросить сверку ФГИС').length).toBeGreaterThan(0);
    expect(text).toMatch(/банковск(ая|ую) проверк/i);
    expect(text).toMatch(/На банковскую проверку/i);
  });

  it('does not expose money-release or technical claims on the command center entry', () => {
    const { container } = render(<PlatformCommandCenterHub />);
    const text = container.textContent || '';

    expect(text).not.toMatch(/выпуск денег/i);
    expect(text).not.toMatch(/можно выпускать/i);
    expect(text).not.toMatch(/выпустить деньги/i);
    expect(text).not.toMatch(/платформа выпускает деньги/i);
    expect(text).not.toMatch(/деньги автоматически выпускаются/i);
    expect(text).not.toMatch(/production-ready/i);
    expect(text).not.toMatch(/fully live/i);
    expect(text).not.toMatch(/callback/i);
    expect(text).not.toMatch(/runtime/i);
  });
});
