import { describe, expect, it } from 'vitest';
import {
  ANTI_BYPASS_CONTROLS,
  ANTI_BYPASS_STRENGTH_LABEL,
  getActiveControlCount,
  getAntiBypassControls,
  getPartialControlCount,
} from '@/lib/platform-v7/anti-bypass-control';

const FORBIDDEN_OVERCLAIMS = [
  /guarantees/i,
  /prevents completely/i,
  /impossible/i,
  /fully protected/i,
  /no risks/i,
  /гарантирует/i,
  /полностью исключает/i,
  /невозможно/i,
  /полная защита/i,
  /production-ready/i,
  /fully live/i,
];

const FORBIDDEN_DEMO_LINKS = ['/platform-v7/demo/'];

function assertNoOverclaims(text: string, label: string) {
  for (const pattern of FORBIDDEN_OVERCLAIMS) {
    expect(text, `${label} contains overclaim: ${pattern}`).not.toMatch(pattern);
  }
  for (const link of FORBIDDEN_DEMO_LINKS) {
    expect(text, `${label} contains demo link`).not.toContain(link);
  }
}

describe('anti-bypass-control data', () => {
  it('exports strength labels for all three levels', () => {
    expect(ANTI_BYPASS_STRENGTH_LABEL.active).toBeTruthy();
    expect(ANTI_BYPASS_STRENGTH_LABEL.partial).toBeTruthy();
    expect(ANTI_BYPASS_STRENGTH_LABEL.requires_setup).toBeTruthy();
  });

  it('every control has required non-empty fields and valid strength', () => {
    for (const context of ['seller', 'buyer', 'control-tower'] as const) {
      for (const control of ANTI_BYPASS_CONTROLS[context]) {
        expect(control.key.length).toBeGreaterThan(0);
        expect(control.name.length).toBeGreaterThan(0);
        expect(control.description.length).toBeGreaterThan(0);
        expect(control.strength).toMatch(/^(active|partial|requires_setup)$/);
        expect(control.pilotEffect.length).toBeGreaterThan(0);
      }
    }
  });

  it('all three contexts expose the same controls (shared set)', () => {
    const sellerKeys = getAntiBypassControls('seller').map((c) => c.key).sort();
    const buyerKeys = getAntiBypassControls('buyer').map((c) => c.key).sort();
    const towerKeys = getAntiBypassControls('control-tower').map((c) => c.key).sort();
    expect(sellerKeys).toEqual(buyerKeys);
    expect(buyerKeys).toEqual(towerKeys);
  });

  it('each context has at least 1 active and at least 1 partial control', () => {
    for (const context of ['seller', 'buyer', 'control-tower'] as const) {
      expect(getActiveControlCount(context)).toBeGreaterThanOrEqual(1);
      expect(getPartialControlCount(context)).toBeGreaterThanOrEqual(1);
    }
  });

  it('pilotEffect uses cautious wording — снижает/затрудняет/сохраняет rather than overclaims', () => {
    for (const context of ['seller', 'buyer', 'control-tower'] as const) {
      for (const control of getAntiBypassControls(context)) {
        expect(control.pilotEffect).toMatch(/снижает|затрудняет|сохраняет|создаёт|трассировка|сложнее/i);
      }
    }
  });

  it('all data avoids overclaims and forbidden wording', () => {
    const serialised = JSON.stringify(ANTI_BYPASS_CONTROLS);
    assertNoOverclaims(serialised, 'ANTI_BYPASS_CONTROLS');
  });

  it('known control keys are present: document_trail, payment_reserve, dispute_evidence, route_audit, counterparty_reliability', () => {
    const keys = getAntiBypassControls('seller').map((c) => c.key);
    expect(keys).toContain('document_trail');
    expect(keys).toContain('payment_reserve');
    expect(keys).toContain('dispute_evidence');
    expect(keys).toContain('route_audit');
    expect(keys).toContain('counterparty_reliability');
  });
});
