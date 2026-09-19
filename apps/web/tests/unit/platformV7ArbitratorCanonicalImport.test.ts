import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Phase 2 / PR-4 — arbitrator legacy import cleanup.
// The active /platform-v7/arbitrator page must not import a page default-export from
// the legacy app/platform-v7r route tree. The dispute-room cockpit now lives in a
// canonical platform-v7 component; UI/logic are unchanged (relocation, not rewrite).

const pageSource = readFileSync(
  resolve(__dirname, '../../app/platform-v7/arbitrator/page.tsx'),
  'utf8',
);
const componentSource = readFileSync(
  resolve(__dirname, '../../components/platform-v7/ArbitratorDisputeRoom.tsx'),
  'utf8',
);

describe('platform-v7 arbitrator canonical import boundary', () => {
  it('does not import a page from the legacy app/platform-v7r route tree', () => {
    expect(pageSource).not.toMatch(/from ['"]@\/app\/platform-v7r\//);
    expect(pageSource).not.toContain('app/platform-v7r/arbitrator/page');
  });

  it('renders the dispute room from the canonical platform-v7 component', () => {
    expect(pageSource).toContain(
      "import { ArbitratorDisputeRoom } from '@/components/platform-v7/ArbitratorDisputeRoom'",
    );
    expect(pageSource).toContain('<ArbitratorDisputeRoom />');
  });

  it('keeps the relocated component a client component with a named export and no legacy page import', () => {
    expect(componentSource).toContain("'use client'");
    expect(componentSource).toContain('export function ArbitratorDisputeRoom()');
    expect(componentSource).not.toMatch(/from ['"]@\/app\/platform-v7r\//);
  });

  it('keeps arbitrator surfaces free from fake-live / production-ready overclaims', () => {
    for (const source of [pageSource, componentSource]) {
      expect(source).not.toMatch(/production-ready/i);
      expect(source).not.toMatch(/fully live/i);
      expect(source).not.toMatch(/bank connected/i);
      expect(source).not.toMatch(/деньги автоматически выпускаются/i);
      expect(source).not.toMatch(/платформа гарантирует оплату/i);
    }
  });
});
