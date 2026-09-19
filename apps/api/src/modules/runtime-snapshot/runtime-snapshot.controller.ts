import { Controller, Get, Req, Res } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import type { Request, Response } from 'express';

const DEMO_SNAPSHOT = {
  ok: true,
  role: 'operator',
  userId: 'user-demo-001',
  orgId: 'org-demo-001',
  dealId: 'DL-9103',
  deals: [
    { id: 'DL-9101', status: 'CLOSED', culture: 'Пшеница 3 кл.', volumeTons: 320, totalRub: 4_640_000, sellerOrgId: 'org-farmer-1', buyerOrgId: 'org-buyer-1' },
    { id: 'DL-9102', status: 'DISPUTE_OPEN', culture: 'Пшеница 4 кл.', volumeTons: 150, totalRub: 2_100_000, sellerOrgId: 'org-farmer-2', buyerOrgId: 'org-buyer-2' },
    { id: 'DL-9103', status: 'IN_TRANSIT', culture: 'Кукуруза 3 кл.', volumeTons: 150, totalRub: 2_400_000, sellerOrgId: 'org-farmer-3', buyerOrgId: 'org-buyer-3' },
    { id: 'DL-9104', status: 'QUALITY_CHECK', culture: 'Ячмень', volumeTons: 200, totalRub: 2_400_000, sellerOrgId: 'org-farmer-4', buyerOrgId: 'org-buyer-4' },
    { id: 'DL-9105', status: 'SETTLED', culture: 'Подсолнечник', volumeTons: 80, totalRub: 3_600_000, sellerOrgId: 'org-farmer-5', buyerOrgId: 'org-buyer-5' },
  ],
  disputes: [
    { id: 'DK-2024-89', dealId: 'DL-9102', status: 'OPEN', amountHeld: 2_100_000, type: 'QUALITY' },
  ],
  logistics: [
    { id: 'ТМБ-14', plate: 'А777ВВ136', dealId: 'DL-9103', status: 'В пути', eta: '14:30' },
  ],
  queue: [
    { plate: 'О123АА136', dealId: 'DL-9103', weight: 32.4, arrived: '11:20', status: 'Взвешивается' },
    { plate: 'В456КК161', dealId: 'DL-9104', weight: null, arrived: '12:05', status: 'Ожидает взвешивания' },
    { plate: 'М789РР123', dealId: 'DL-9104', weight: null, arrived: '12:45', status: 'Ожидает взвешивания' },
  ],
  samples: [
    { id: 'ЛАБ-2847', dealId: 'DL-9102', cargo: 'Пшеница 4 кл.', received: '12:00', status: 'Ожидает анализа' },
    { id: 'ЛАБ-2851', dealId: 'DL-9104', cargo: 'Ячмень 3 кл.', received: '13:30', status: 'Ожидает анализа' },
  ],
  kpis: {
    gmv30d: '4,2 млн ₽',
    dealsActive: 3,
    disputeRate: 8,
    avgCloseDays: 8.3,
  },
};

@Controller('runtime-me-snapshot')
export class RuntimeSnapshotController {
  @Get()
  @Public()
  getSnapshot(@Req() req: Request): typeof DEMO_SNAPSHOT {
    const authHeader = req.headers?.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      // With real JWT, we'd query the DB for user-specific data.
      // For now, return demo snapshot — the auth-aware version requires live DB.
    }
    return DEMO_SNAPSHOT;
  }
}

@Controller('runtime-me-stream')
export class RuntimeStreamController {
  @Get()
  @Public()
  stream(@Res() res: Response): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const send = (data: unknown) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    send({ type: 'connected', ts: new Date().toISOString() });

    const interval = setInterval(() => {
      send({ type: 'heartbeat', ts: new Date().toISOString() });
    }, 25_000);

    res.on('close', () => {
      clearInterval(interval);
    });
  }
}
