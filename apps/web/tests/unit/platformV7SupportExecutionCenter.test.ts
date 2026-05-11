import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SUPPORT_CASES, SUPPORT_INTERNAL_NOTES } from '@/lib/platform-v7/support-data';
import { supportLinkedExecutionHref } from '@/lib/platform-v7/support-helpers';
import { SUPPORT_MATURITY_LABEL } from '@/lib/platform-v7/support-types';
import type { SupportCase } from '@/lib/platform-v7/support-types';

const COMPONENTS_DIR = resolve(__dirname, '../../components/platform-v7');
const readComponent = (name: string) => readFileSync(resolve(COMPONENTS_DIR, name), 'utf-8');

const FORBIDDEN_COPY = [
  'production-ready',
  'fully live',
  'live callback',
  'fully integrated',
  'платформа гарантирует оплату',
  'платформа выпускает деньги',
  'деньги переведены',
  'выплата выполнена',
  '/platform-v7/demo/',
] as const;

function caseText(item: SupportCase): string {
  return [item.title, item.description, item.nextAction, item.blocker, item.owner].join(' ');
}

describe('platform-v7 support execution center hardening', () => {
  describe('required execution fields', () => {
    it('all support cases carry nextAction, blocker, owner, slaDueAt, priority, category, relatedEntityId', () => {
      for (const item of SUPPORT_CASES) {
        expect(item.nextAction, `${item.id} must have nextAction`).toBeTruthy();
        expect(item.blocker, `${item.id} must have blocker`).toBeTruthy();
        expect(item.owner, `${item.id} must have owner`).toBeTruthy();
        expect(item.slaDueAt, `${item.id} must have slaDueAt`).toBeTruthy();
        expect(item.priority, `${item.id} must have priority`).toMatch(/^P[0-3]$/);
        expect(item.category, `${item.id} must have category`).toBeTruthy();
        expect(item.relatedEntityId, `${item.id} must have relatedEntityId`).toBeTruthy();
      }
    });

    it('all support cases carry money at risk field (may be zero)', () => {
      for (const item of SUPPORT_CASES) {
        expect(typeof item.moneyAtRiskRub, `${item.id} moneyAtRiskRub must be a number`).toBe('number');
      }
    });
  });

  describe('forbidden copy guard', () => {
    it('support case data does not contain forbidden copy', () => {
      for (const item of SUPPORT_CASES) {
        const text = caseText(item).toLowerCase();
        for (const forbidden of FORBIDDEN_COPY) {
          expect(text, `${item.id} must not contain "${forbidden}"`).not.toContain(forbidden.toLowerCase());
        }
      }
    });

    it('SUPPORT_MATURITY_LABEL uses pilot framing, not production-ready or fully-live claims', () => {
      const label = SUPPORT_MATURITY_LABEL.toLowerCase();
      expect(label, 'maturity label must reference pilot contour').toContain('пилот');
      expect(label, 'maturity label must not claim production-ready').not.toContain('production-ready');
      expect(label, 'maturity label must not claim fully live').not.toContain('fully live');
    });
  });

  describe('linked execution routes', () => {
    it('supportLinkedExecutionHref never produces demo or landing paths', () => {
      for (const item of SUPPORT_CASES) {
        const href = supportLinkedExecutionHref(item);
        expect(href, `${item.id} linked href must not go to demo path`).not.toContain('/platform-v7/demo/');
        expect(href, `${item.id} linked href must stay within platform-v7`).toMatch(/^\/platform-v7\//);
      }
    });

    it('dispute and money entity types resolve to correct platform-v7 routes', () => {
      const base = SUPPORT_CASES[0];
      expect(supportLinkedExecutionHref({ ...base, relatedEntityType: 'dispute', relatedEntityId: 'DISP-1' })).toContain('/platform-v7/disputes');
      expect(supportLinkedExecutionHref({ ...base, relatedEntityType: 'money', relatedEntityId: 'MON-1' })).toContain('/platform-v7/bank');
      expect(supportLinkedExecutionHref({ ...base, relatedEntityType: 'integration', relatedEntityId: 'INT-1' })).toContain('/platform-v7/connectors');
    });
  });

  describe('internal note leakage prevention', () => {
    it('SupportCaseView does not render Внутренние заметки section', () => {
      const src = readComponent('SupportCaseView.tsx');
      expect(src, 'SupportCaseView must not expose internal notes heading to users').not.toContain('Внутренние заметки');
    });

    it('SupportCaseView does not accept a notes prop', () => {
      const src = readComponent('SupportCaseView.tsx');
      expect(src, 'SupportCaseView must not accept notes prop').not.toMatch(/notes:\s*SupportInternalNote/);
      expect(src, 'SupportCaseView must not import SupportInternalNote').not.toContain('SupportInternalNote');
    });

    it('SupportCaseRouteClient does not forward internalNotes to SupportCaseView', () => {
      const src = readComponent('SupportCaseRouteClient.tsx');
      expect(src, 'SupportCaseRouteClient must not pass internalNotes to view').not.toMatch(/notes=\{internalNotes/);
    });

    it('SUPPORT_INTERNAL_NOTES data exists but is not passed through user-facing view', () => {
      // Internal notes data is valid and exists for operator tooling
      expect(SUPPORT_INTERNAL_NOTES.length).toBeGreaterThan(0);
      // Each note is typed correctly (operator-private, not user-facing)
      for (const note of SUPPORT_INTERNAL_NOTES) {
        expect(note.id).toBeTruthy();
        expect(note.caseId).toBeTruthy();
        expect(note.author).toBeTruthy();
        expect(note.body).toBeTruthy();
      }
    });
  });

  describe('no apps/landing imports', () => {
    const supportComponentFiles = [
      'SupportIndexPage.tsx',
      'SupportCaseView.tsx',
      'SupportCaseRouteClient.tsx',
      'SupportNewCaseClient.tsx',
      'SupportOperatorQueueClient.tsx',
      'SupportEntry.tsx',
    ];

    it('no support component imports from apps/landing', () => {
      for (const file of supportComponentFiles) {
        const src = readComponent(file);
        expect(src, `${file} must not import from apps/landing`).not.toContain('apps/landing');
        expect(src, `${file} must not import from landing/`).not.toContain("from 'landing/");
        expect(src, `${file} must not import from @/landing`).not.toContain("from '@/landing");
      }
    });
  });

  describe('execution support framing', () => {
    it('SupportIndexPage is framed as execution support center, not generic chat', () => {
      const src = readComponent('SupportIndexPage.tsx');
      expect(src, 'support index must have execution center heading').toContain('Центр поддержки исполнения');
    });

    it('SupportNewCaseClient states the helper does not move money or change deal status', () => {
      const src = readComponent('SupportNewCaseClient.tsx');
      expect(src, 'new case helper must disclaim money release').toContain('не выпускает деньги');
    });

    it('SupportOperatorQueueClient is labeled as execution support operator queue', () => {
      const src = readComponent('SupportOperatorQueueClient.tsx');
      expect(src, 'operator queue must be labeled as execution support').toContain('поддержки исполнения');
    });
  });
});
