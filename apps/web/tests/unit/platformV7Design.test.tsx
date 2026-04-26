import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { P7Badge } from '@/components/platform-v7/P7Badge';
import { P7Card } from '@/components/platform-v7/P7Card';
import { P7MetricCard } from '@/components/platform-v7/P7MetricCard';
import { P7Page } from '@/components/platform-v7/P7Page';
import { P7Section } from '@/components/platform-v7/P7Section';
import { P7Toolbar } from '@/components/platform-v7/P7Toolbar';
import { contrastRatio, meetsWcagAaLargeTextOrUi, meetsWcagAaText } from '@/lib/platform-v7/design/contrast';
import { getPlatformV7ToneTokens, PLATFORM_V7_TOKENS, type PlatformV7Tone } from '@/lib/platform-v7/design/tokens';

describe('platform-v7 design tokens', () => {
  it('keeps core brand and semantic colors stable', () => {
    expect(PLATFORM_V7_TOKENS.color.brand).toBe('#0A7A5F');
    expect(PLATFORM_V7_TOKENS.color.accent).toBe('#B68A35');
    expect(PLATFORM_V7_TOKENS.color.money).toBe('#155EEF');
    expect(PLATFORM_V7_TOKENS.color.evidence).toBe('#6941C6');
    expect(PLATFORM_V7_TOKENS.color.integration).toBe('#0E9384');
  });

  it('returns tone tokens for product states', () => {
    expect(getPlatformV7ToneTokens('success')).toMatchObject({ fg: '#027A48' });
    expect(getPlatformV7ToneTokens('warning')).toMatchObject({ fg: '#B54708' });
    expect(getPlatformV7ToneTokens('danger')).toMatchObject({ fg: '#B42318' });
    expect(getPlatformV7ToneTokens('money')).toMatchObject({ fg: '#155EEF' });
    expect(getPlatformV7ToneTokens('evidence')).toMatchObject({ fg: '#6941C6' });
    expect(getPlatformV7ToneTokens('integration')).toMatchObject({ fg: '#0E9384' });
  });

  it('keeps spacing and typography numeric', () => {
    expect(PLATFORM_V7_TOKENS.spacing.md).toBe(16);
    expect(PLATFORM_V7_TOKENS.radius.lg).toBe(16);
    expect(PLATFORM_V7_TOKENS.typography.metric.size).toBe(30);
  });
});

describe('platform-v7 contrast helpers', () => {
  it('calculates the standard black-white contrast ratio', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBe(21);
  });

  it('keeps base text colors AA-compliant on the main surface', () => {
    expect(meetsWcagAaText(PLATFORM_V7_TOKENS.color.text, PLATFORM_V7_TOKENS.color.surface)).toBe(true);
    expect(meetsWcagAaText(PLATFORM_V7_TOKENS.color.textMuted, PLATFORM_V7_TOKENS.color.surface)).toBe(true);
  });

  it('keeps semantic tone pairs UI-AA compliant', () => {
    const tones: readonly PlatformV7Tone[] = ['neutral', 'success', 'warning', 'danger', 'info', 'money', 'evidence', 'integration'];

    for (const tone of tones) {
      const colors = getPlatformV7ToneTokens(tone);
      expect(meetsWcagAaLargeTextOrUi(colors.fg, colors.bg)).toBe(true);
    }
  });
});

describe('P7Badge', () => {
  it('renders children', () => {
    render(<P7Badge tone='success'>PASS</P7Badge>);
    expect(screen.getByText('PASS')).toBeInTheDocument();
  });

  it('uses semantic tone colors', () => {
    render(<P7Badge tone='danger'>FAIL</P7Badge>);
    expect(screen.getByText('FAIL')).toHaveStyle({ color: '#B42318' });
  });
});

describe('P7Card', () => {
  it('renders title, subtitle, content and footer', () => {
    render(
      <P7Card title='Сделка' subtitle='Документы и деньги' footer={<span>Открыть</span>} testId='p7-card'>
        Тело карточки
      </P7Card>,
    );

    expect(screen.getByTestId('p7-card')).toBeInTheDocument();
    expect(screen.getByText('Сделка')).toBeInTheDocument();
    expect(screen.getByText('Документы и деньги')).toBeInTheDocument();
    expect(screen.getByText('Тело карточки')).toBeInTheDocument();
    expect(screen.getByText('Открыть')).toBeInTheDocument();
  });
});

describe('P7MetricCard', () => {
  it('renders metric title, value, note and footer', () => {
    render(
      <P7MetricCard title='В резерве' value='12,4 млн ₽' note='canonical registry' footer={<span>Перейти</span>} tone='money' testId='metric-card' />,
    );

    expect(screen.getByTestId('metric-card')).toBeInTheDocument();
    expect(screen.getByText('В резерве')).toBeInTheDocument();
    expect(screen.getByText('12,4 млн ₽')).toBeInTheDocument();
    expect(screen.getByText('canonical registry')).toBeInTheDocument();
    expect(screen.getByText('Перейти')).toBeInTheDocument();
  });

  it('uses semantic tone surfaces', () => {
    render(<P7MetricCard title='Evidence' value='5/5' tone='evidence' testId='evidence-metric' />);
    expect(screen.getByTestId('evidence-metric')).toHaveStyle({ background: '#F4F3FF' });
  });
});

describe('P7Page', () => {
  it('renders page title, subtitle, actions and content', () => {
    render(
      <P7Page title='Центр управления' subtitle='Единый контур сделки' actions={<button type='button'>Фильтр</button>} testId='p7-page'>
        Рабочая область
      </P7Page>,
    );

    expect(screen.getByTestId('p7-page')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Центр управления' })).toBeInTheDocument();
    expect(screen.getByText('Единый контур сделки')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Фильтр' })).toBeInTheDocument();
    expect(screen.getByText('Рабочая область')).toBeInTheDocument();
  });

  it('renders content without an optional header', () => {
    render(<P7Page testId='p7-page-no-header'>Только контент</P7Page>);
    expect(screen.getByTestId('p7-page-no-header')).toBeInTheDocument();
    expect(screen.getByText('Только контент')).toBeInTheDocument();
  });
});

describe('P7Section', () => {
  it('renders section title, subtitle, actions and content', () => {
    render(
      <P7Section title='Очередь проблем' subtitle='Сортировка по SLA' actions={<button type='button'>Экспорт</button>} testId='p7-section'>
        Карточки очереди
      </P7Section>,
    );

    expect(screen.getByTestId('p7-section')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Очередь проблем' })).toBeInTheDocument();
    expect(screen.getByText('Сортировка по SLA')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Экспорт' })).toBeInTheDocument();
    expect(screen.getByText('Карточки очереди')).toBeInTheDocument();
  });
});

describe('P7Toolbar', () => {
  it('renders toolbar content inside the standard surface', () => {
    render(
      <P7Toolbar testId='p7-toolbar'>
        <button type='button'>Фильтры</button>
        <button type='button'>Сохранить вид</button>
      </P7Toolbar>,
    );

    expect(screen.getByTestId('p7-toolbar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Фильтры' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Сохранить вид' })).toBeInTheDocument();
    expect(screen.getByTestId('p7-toolbar')).toHaveStyle({ background: '#FFFFFF' });
  });
});
