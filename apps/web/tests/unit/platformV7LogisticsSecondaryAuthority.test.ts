import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const detail = read('apps/web/app/platform-v7/logistics/[routeId]/page.tsx');
const drivers = read('apps/web/app/platform-v7/logistics/drivers/page.tsx');
const inbox = read('apps/web/app/platform-v7/logistics/inbox/page.tsx');
const routePolicy = read('apps/web/lib/platform-v7/design-system-v8-route-policy.ts');
const governance = JSON.parse(read('design-governance-v8.json')) as { migratedFiles: string[] };
const forbiddenPresentation = /style\s*=\s*\{\{|dangerouslySetInnerHTML|#[0-9a-f]{3,8}\b|\brgba?\s*\(|!important/i;

describe('platform-v7 logistics secondary server authority', () => {
  it('uses the governed v8 cockpit without legacy presentation runtime', () => {
    for (const source of [detail, drivers, inbox]) {
      expect(source).toContain('OperationalDecisionCockpit');
      expect(source).toContain("from '@/lib/logistics-server'");
      expect(source).not.toContain("'use client'");
      expect(source).not.toMatch(forbiddenPresentation);
    }
  });

  it('loads shipment detail from the tenant-scoped workspace endpoint', () => {
    expect(detail).toContain('getShipmentWorkspace');
    expect(detail).toContain('workspace = await getShipmentWorkspace(routeId)');
    expect(detail).toContain("testId='platform-v7-logistics-shipment-v8'");
    expect(detail).not.toContain('const ROUTES');
    expect(detail).not.toContain('ТМБ-14');
    expect(detail).not.toContain('ВРЖ-08');
    expect(detail).not.toContain('КРС-03');
    expect(detail).not.toContain('RouteMapStub');
  });

  it('builds driver and inbox queues from server shipments only', () => {
    expect(drivers).toContain('const shipments = await getShipments()');
    expect(inbox).toContain('const shipments = (await getShipments()).sort');
    for (const forbidden of ['DRV-TEST-001', 'DRV-TEST-002', 'LOG-REQ-2403', 'TRIP-2403-001', 'SHIP-001', 'controlled-pilot']) {
      expect(drivers).not.toContain(forbidden);
      expect(inbox).not.toContain(forbidden);
    }
  });

  it('keeps authority boundaries and controls translated in RU EN and ZH', () => {
    expect(detail).toContain('Рейс не подтверждён серверным контуром');
    expect(detail).toContain('The shipment is not confirmed by the server authority');
    expect(detail).toContain('服务器权威未确认该运输任务');
    expect(drivers).toContain('Назначения только из серверного реестра рейсов');
    expect(drivers).toContain('Assignments come from the server shipment registry only');
    expect(drivers).toContain('指派仅来自服务器运输任务登记册');
    expect(inbox).toContain('Очередь формируется из реальных рейсов Сделок');
    expect(inbox).toContain('The queue is built from actual Deal shipments');
    expect(inbox).toContain('队列由真实交易运输任务构成');
  });

  it('registers the full logistics family in minimal v8 runtime and governance', () => {
    expect(routePolicy).toContain("'/platform-v7/logistics'");
    expect(governance.migratedFiles).toContain('apps/web/app/platform-v7/logistics/[routeId]/page.tsx');
    expect(governance.migratedFiles).toContain('apps/web/app/platform-v7/logistics/drivers/page.tsx');
    expect(governance.migratedFiles).toContain('apps/web/app/platform-v7/logistics/inbox/page.tsx');
  });
});
