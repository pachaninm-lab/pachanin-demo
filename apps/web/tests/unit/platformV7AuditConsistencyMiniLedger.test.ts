import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  AUDIT_LEDGER_DATA,
  BOUNDARY_STATUS_ICONS,
  getAuditLedger,
  getEntriesBlockingRelease,
  type AuditLedgerContext,
} from '../../lib/platform-v7/audit-consistency-ledger';
import { AuditConsistencyMiniLedger } from '../../components/platform-v7/AuditConsistencyMiniLedger';

const ALL_CONTEXTS: AuditLedgerContext[] = ['bank', 'disputes', 'control-tower'];

const FORBIDDEN_PATTERNS = [
  'production-ready',
  'fully live',
  'live callback',
  'деньги переведены',
  'bypass impossible',
  'fully protected',
  'автоматически выплачивается',
  'гарантирует выпуск',
];

function assertNoForbiddenWording(text: string) {
  for (const pattern of FORBIDDEN_PATTERNS) {
    expect(text.toLowerCase()).not.toContain(pattern.toLowerCase());
  }
}

describe('audit-consistency-ledger data', () => {
  it('has entries for all 3 contexts', () => {
    expect(Object.keys(AUDIT_LEDGER_DATA)).toHaveLength(3);
    for (const ctx of ALL_CONTEXTS) {
      expect(AUDIT_LEDGER_DATA[ctx]).toBeDefined();
    }
  });

  it('every context has exactly 3 audit entries', () => {
    for (const ctx of ALL_CONTEXTS) {
      expect(AUDIT_LEDGER_DATA[ctx].entries).toHaveLength(3);
    }
  });

  it('every entry has all required fields', () => {
    for (const ctx of ALL_CONTEXTS) {
      for (const entry of AUDIT_LEDGER_DATA[ctx].entries) {
        expect(entry.id).toBeTruthy();
        expect(entry.eventLabel).toBeTruthy();
        expect(entry.actorRole).toBeTruthy();
        expect(entry.entity).toBeTruthy();
        expect(entry.evidenceRef).toBeTruthy();
        expect(entry.moneyImpact).toMatch(/^(none|blocks_release|affects_hold|informs_reserve)$/);
        expect(entry.moneyImpactLabel).toBeTruthy();
        expect(entry.boundaryStatus).toMatch(/^(internal|pending_external|requires_bank_event)$/);
        expect(entry.boundaryStatusLabel).toBeTruthy();
        expect(entry.auditPreviewNote).toBeTruthy();
      }
    }
  });

  it('every pilotDisclaimer references пилотный контур', () => {
    for (const ctx of ALL_CONTEXTS) {
      expect(AUDIT_LEDGER_DATA[ctx].pilotDisclaimer.toLowerCase()).toContain('пилотный контур');
    }
  });

  it('every pilotDisclaimer references аудит-предпросмотр', () => {
    for (const ctx of ALL_CONTEXTS) {
      expect(AUDIT_LEDGER_DATA[ctx].pilotDisclaimer.toLowerCase()).toContain('аудит-предпросмотр');
    }
  });

  it('every auditPreviewNote references аудит-предпросмотр', () => {
    for (const ctx of ALL_CONTEXTS) {
      for (const entry of AUDIT_LEDGER_DATA[ctx].entries) {
        expect(entry.auditPreviewNote.toLowerCase()).toContain('аудит-предпросмотр');
      }
    }
  });

  it('each context has at least one blocks_release entry', () => {
    for (const ctx of ALL_CONTEXTS) {
      const blocking = getEntriesBlockingRelease(ctx);
      expect(blocking.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('getAuditLedger returns correct data', () => {
    for (const ctx of ALL_CONTEXTS) {
      expect(getAuditLedger(ctx)).toStrictEqual(AUDIT_LEDGER_DATA[ctx]);
    }
  });

  it('BOUNDARY_STATUS_ICONS has entries for all 3 statuses', () => {
    expect(BOUNDARY_STATUS_ICONS['internal']).toBeTruthy();
    expect(BOUNDARY_STATUS_ICONS['pending_external']).toBeTruthy();
    expect(BOUNDARY_STATUS_ICONS['requires_bank_event']).toBeTruthy();
  });

  it('bank context includes DL-9106 entity reference', () => {
    const bankEntries = AUDIT_LEDGER_DATA['bank'].entries;
    const dl9106 = bankEntries.find((e) => e.entity.includes('DL-9106'));
    expect(dl9106).toBeDefined();
  });

  it('disputes context references weight dispute DSP-9102-WEIGHT', () => {
    const disputeEntries = AUDIT_LEDGER_DATA['disputes'].entries;
    const weightDispute = disputeEntries.find((e) => e.entity.includes('DSP-9102-WEIGHT'));
    expect(weightDispute).toBeDefined();
  });

  it('no forbidden wording anywhere in data', () => {
    for (const ctx of ALL_CONTEXTS) {
      const ledger = AUDIT_LEDGER_DATA[ctx];
      const allText = [
        ledger.title,
        ledger.pilotDisclaimer,
        ...ledger.entries.flatMap((e) => [
          e.eventLabel,
          e.actorRole,
          e.entity,
          e.evidenceRef,
          e.moneyImpactLabel,
          e.boundaryStatusLabel,
          e.auditPreviewNote,
        ]),
      ].join(' ');
      assertNoForbiddenWording(allText);
    }
  });
});

describe('AuditConsistencyMiniLedger component', () => {
  for (const ctx of ALL_CONTEXTS) {
    it(`renders ledger container for context: ${ctx}`, () => {
      render(React.createElement(AuditConsistencyMiniLedger, { context: ctx }));
      expect(screen.getByTestId('platform-v7-audit-consistency-mini-ledger')).toBeDefined();
    });

    it(`renders pilot disclaimer for context: ${ctx}`, () => {
      render(React.createElement(AuditConsistencyMiniLedger, { context: ctx }));
      const disclaimer = screen.getByTestId('platform-v7-audit-ledger-disclaimer');
      expect(disclaimer).toBeDefined();
      expect(disclaimer.textContent).toContain('пилотный контур');
      expect(disclaimer.textContent).toContain('аудит-предпросмотр');
    });

    it(`renders 3 audit entries for context: ${ctx}`, () => {
      render(React.createElement(AuditConsistencyMiniLedger, { context: ctx }));
      const entries = screen.getAllByTestId('platform-v7-audit-ledger-entry');
      expect(entries).toHaveLength(3);
    });

    it(`renders actor labels for context: ${ctx}`, () => {
      render(React.createElement(AuditConsistencyMiniLedger, { context: ctx }));
      const actors = screen.getAllByTestId('platform-v7-audit-ledger-actor');
      expect(actors).toHaveLength(3);
    });

    it(`renders money-impact sections for context: ${ctx}`, () => {
      render(React.createElement(AuditConsistencyMiniLedger, { context: ctx }));
      const impacts = screen.getAllByTestId('platform-v7-audit-ledger-money-impact');
      expect(impacts).toHaveLength(3);
    });

    it(`renders boundary-status chips for context: ${ctx}`, () => {
      render(React.createElement(AuditConsistencyMiniLedger, { context: ctx }));
      const boundaries = screen.getAllByTestId('platform-v7-audit-ledger-boundary');
      expect(boundaries).toHaveLength(3);
    });

    it(`renders preview notes containing аудит-предпросмотр for context: ${ctx}`, () => {
      render(React.createElement(AuditConsistencyMiniLedger, { context: ctx }));
      const notes = screen.getAllByTestId('platform-v7-audit-ledger-preview-note');
      expect(notes).toHaveLength(3);
      for (const note of notes) {
        expect(note.textContent?.toLowerCase()).toContain('аудит-предпросмотр');
      }
    });

    it(`no forbidden wording in rendered DOM for context: ${ctx}`, () => {
      render(React.createElement(AuditConsistencyMiniLedger, { context: ctx }));
      const container = screen.getByTestId('platform-v7-audit-consistency-mini-ledger');
      assertNoForbiddenWording(container.textContent ?? '');
    });
  }
});
