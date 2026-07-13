import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const roles = {
  driver: read('apps/web/app/platform-v7/driver/field/page.tsx'),
  elevator: read('apps/web/app/platform-v7/elevator/page.tsx'),
  lab: read('apps/web/app/platform-v7/lab/page.tsx'),
  surveyor: read('apps/web/app/platform-v7/surveyor/page.tsx'),
};

const fieldTemplate = read('apps/web/components/transaction-ux/FieldTaskTemplate.tsx');
const fieldStyles = read('apps/web/components/transaction-ux/FieldRoleWorkspace.module.css');
const designTemplates = read('packages/design-system-v8/src/templates.tsx');
const designStyles = read('packages/design-system-v8/src/templates.module.css');
const governance = JSON.parse(read('design-governance-v8.json'));
const forbiddenPresentation = /style\s*=\s*\{\{|dangerouslySetInnerHTML|#[0-9a-f]{3,8}\b|\brgba?\s*\(|!important/i;

describe('Design System v8 field role reference slice', () => {
  it('uses one field template and one intake specialization', () => {
    expect(fieldTemplate).toContain('WorkbenchTemplate');
    expect(fieldTemplate).toContain("density='field'");
    expect(fieldTemplate).toContain('export function IntakeWorkbenchTemplate');
    expect(designTemplates).toContain('export function WorkbenchTemplate');
    expect(designTemplates).toContain('export function NextActionPanel');
    expect(designTemplates).toContain('export function KeyFactGrid');
  });

  it('migrates all four field roles without local presentation debt', () => {
    for (const [role, source] of Object.entries(roles)) {
      expect(source, role).toContain("from '@pc/design-system-v8'");
      expect(source, role).toMatch(/FieldTaskTemplate|IntakeWorkbenchTemplate/);
      expect(source, role).toContain('NextActionPanel');
      expect(source, role).not.toMatch(forbiddenPresentation);
    }
    expect(fieldStyles).not.toMatch(forbiddenPresentation);
    expect(designStyles).not.toMatch(forbiddenPresentation);
  });

  it('keeps driver mobile, evidence and offline capabilities', () => {
    expect(roles.driver).toContain('DriverMissionRouteCard');
    expect(roles.driver).toContain('DriverCameraCapture');
    expect(roles.driver).toContain('DriverOfflineQueue');
    expect(roles.driver).toContain('PwaOfflinePanel');
    expect(roles.driver).toContain("data-hidden-controls='финансовый контур, ставки и платёжные данные скрыты от водителя'");
  });

  it('keeps elevator intake, weighing and handoff capabilities', () => {
    expect(roles.elevator).toContain('WeighStationPanel');
    expect(roles.elevator).toContain('FieldElevatorRuntime');
    expect(roles.elevator).toContain('EvidenceReadinessMiniMatrix');
    expect(roles.elevator).toContain('RoleExecutionHandoff');
    expect(roles.elevator).toContain('акт расхождения');
  });

  it('keeps laboratory quality, evidence and protocol capabilities', () => {
    expect(roles.lab).toContain('GostQualityForm');
    expect(roles.lab).toContain('QualityDeltaBars');
    expect(roles.lab).toContain('LabPhotoUpload');
    expect(roles.lab).toContain('FieldLabRuntime');
    expect(roles.lab).toContain('протокол качества');
  });

  it('keeps surveyor assignment and evidence boundaries', () => {
    expect(roles.surveyor).toContain('BatonStrip');
    expect(roles.surveyor).toContain('RoleExecutionSummary');
    expect(roles.surveyor).toContain('независимый акт');
    expect(roles.surveyor).toContain('Решение по деньгам и спору остаётся за уполномоченными ролями');
  });

  it('enforces 48px field controls and accessible display modes', () => {
    expect(fieldStyles).toContain('min-height: var(--ds-control-height)');
    expect(fieldStyles).toContain(':focus-visible');
    expect(fieldStyles).toContain('@media (forced-colors: active)');
    expect(designStyles).toContain('@media (max-width: 560px)');
    expect(designStyles).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('registers the four role routes in governance', () => {
    expect(governance.migratedFiles).toEqual(expect.arrayContaining([
      'apps/web/app/platform-v7/driver/field/page.tsx',
      'apps/web/app/platform-v7/elevator/page.tsx',
      'apps/web/app/platform-v7/lab/page.tsx',
      'apps/web/app/platform-v7/surveyor/page.tsx',
    ]));
  });
});
