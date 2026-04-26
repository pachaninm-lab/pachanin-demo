import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { P7Badge } from '@/components/platform-v7/P7Badge';
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
