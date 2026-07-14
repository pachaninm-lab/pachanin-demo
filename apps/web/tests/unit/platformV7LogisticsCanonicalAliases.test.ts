import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(process.cwd(), '../..');
const read = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const detail = read('apps/web/app/platform-v7/logistics/[routeId]/page.tsx');
const drivers = read('apps/web/app/platform-v7/logistics/drivers/page.tsx');
const inbox = read('apps/web/app/platform-v7/logistics/inbox/page.tsx');

describe('platform-v7 canonical logistics secondary aliases', () => {
  it('preserves the requested shipment identifier in the canonical workspace', () => {
    expect(detail).toContain("import { redirect } from 'next/navigation'");
    expect(detail).toContain('encodeURIComponent(params.routeId)');
    expect(detail).toContain('/platform-v7/deal-logistics?shipmentId=');
    expect(detail).not.toContain('ROUTES');
    expect(detail).not.toContain('RouteMapStub');
    expect(detail).not.toContain("'use client'");
  });

  it('routes drivers and inbox into PostgreSQL-backed shipment authority', () => {
    for (const source of [drivers, inbox]) {
      expect(source).toContain("redirect('/platform-v7/deal-logistics')");
      expect(source).not.toContain('style=');
      expect(source).not.toContain('controlled-pilot');
      expect(source).not.toContain('DL-9106');
    }
  });

  it('removes fixture drivers, shipments, GPS and browser assignments', () => {
    for (const forbidden of [
      'DRV-TEST-001',
      'DRV-TEST-002',
      'LOG-REQ-2403',
      'TRIP-2403-001',
      'ТМБ-14',
      'ВРЖ-08',
      'КРС-03',
      'Ближайший водитель выбран',
      'ЭТрН-2024-003451',
    ]) {
      expect(detail).not.toContain(forbidden);
      expect(drivers).not.toContain(forbidden);
      expect(inbox).not.toContain(forbidden);
    }
  });
});
