import { describe, expect, it } from 'vitest';
import {
  ALL_CABINET_ROLES,
  getCabinetContactDockPolicy,
  type CabinetDockLocale,
} from '../../lib/platform-v7/cabinet-contact-dock-policy';

const LOCALES: readonly CabinetDockLocale[] = ['ru', 'en', 'zh'];

describe('platform-v7 cabinet contact dock policy', () => {
  it('covers all twelve verified cabinet roles in every supported locale', () => {
    expect(ALL_CABINET_ROLES).toHaveLength(12);

    for (const locale of LOCALES) {
      const labels = new Set<string>();
      for (const role of ALL_CABINET_ROLES) {
        const policy = getCabinetContactDockPolicy(role, locale);
        expect(policy.role).toBe(role);
        expect(policy.roleLabel).toBeTruthy();
        expect(policy.roleFocus).toBeTruthy();
        expect(policy.assistantStarter).toBeTruthy();
        expect(policy.supportDomain).toBeTruthy();
        expect(policy.groupLabel).toContain(policy.roleLabel);
        expect(policy.assistantAria).toContain(policy.roleLabel);
        expect(policy.supportAria).toContain(policy.roleLabel);
        expect(policy.callAria).toContain(policy.roleLabel);
        labels.add(policy.roleLabel);
      }
      expect(labels.size).toBe(12);
    }
  });

  it('assigns the correct shell family and operational tone to each cabinet', () => {
    for (const role of ['driver', 'surveyor', 'elevator', 'lab'] as const) {
      const policy = getCabinetContactDockPolicy(role, 'ru');
      expect(policy.shellFamily).toBe('field');
      expect(policy.tone).toBe('field');
    }

    for (const role of ['bank', 'arbitrator', 'compliance'] as const) {
      const policy = getCabinetContactDockPolicy(role, 'ru');
      expect(policy.shellFamily).toBe('role-scoped');
      expect(policy.tone).toBe('review');
    }

    for (const role of ['operator', 'executive'] as const) {
      expect(getCabinetContactDockPolicy(role, 'ru').shellFamily).toBe('operator');
    }
  });

  it('routes support context to the cabinet business domain rather than a generic queue', () => {
    expect(getCabinetContactDockPolicy('driver', 'ru').supportTopic).toBe('logistics');
    expect(getCabinetContactDockPolicy('lab', 'ru').supportTopic).toBe('quality');
    expect(getCabinetContactDockPolicy('bank', 'ru').supportTopic).toBe('payments');
    expect(getCabinetContactDockPolicy('arbitrator', 'ru').supportTopic).toBe('dispute');
    expect(getCabinetContactDockPolicy('compliance', 'ru').supportTopic).toBe('documents');
  });
});
