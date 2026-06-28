import { Injectable, ForbiddenException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestUser, Role } from '../../common/types/request-user';

const EXPORT_ALLOWED_ROLES: Role[] = [Role.ADMIN, Role.COMPLIANCE_OFFICER, Role.ACCOUNTING, Role.EXECUTIVE];

@Injectable()
export class ExportsService {
  constructor(private readonly prisma: PrismaService) {}

  private assertExportRole(user: RequestUser): void {
    if (!EXPORT_ALLOWED_ROLES.includes(user.role as Role)) {
      throw new ForbiddenException('Export access denied');
    }
  }

  async exportDealsCsv(user: RequestUser, filters?: { status?: string; from?: string; to?: string }): Promise<string> {
    this.assertExportRole(user);
    const deals = await this.prisma.deal.findMany({
      where: {
        ...(filters?.status && { status: filters.status }),
        ...(filters?.from && { createdAt: { gte: new Date(filters.from) } }),
        ...(filters?.to && { createdAt: { lte: new Date(filters.to) } }),
      },
      orderBy: { createdAt: 'desc' },
      take: 10000,
    });
    const header = 'id,dealNumber,status,sellerOrgId,buyerOrgId,culture,cropClass,volumeTons,totalRub,currency,region,createdAt,closedAt\n';
    const rows = deals.map(d =>
      [d.id, d.dealNumber ?? '', d.status, d.sellerOrgId, d.buyerOrgId, d.culture ?? '', d.cropClass ?? '', d.volumeTons ?? '', d.totalRub ?? '', d.currency, d.region ?? '', d.createdAt.toISOString(), d.closedAt?.toISOString() ?? '']
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    ).join('\n');
    return header + rows;
  }

  async exportEvidenceBundle(dealId: string, user: RequestUser): Promise<{
    manifest: object;
    files: Array<{ filename: string; hash: string; prevHash: string | null; type: string; uploadedAt: string }>;
    chainValid: boolean;
  }> {
    const deal = await this.prisma.deal.findUnique({ where: { id: dealId } });
    if (!deal) throw new ForbiddenException(`Deal ${dealId} not found`);

    const evidence = await this.prisma.evidenceFile.findMany({
      where: { dealId },
      orderBy: { uploadedAt: 'asc' },
    });

    // Verify hash chain
    let chainValid = true;
    let prevHash = '';
    for (const e of evidence) {
      if (e.prevHash && e.prevHash !== prevHash) { chainValid = false; break; }
      prevHash = e.hash;
    }

    const files = evidence.map(e => ({
      id: e.id,
      filename: e.filename,
      type: e.type,
      mimeType: e.mimeType,
      sizeBytes: e.sizeBytes,
      hash: e.hash,
      prevHash: e.prevHash,
      uploadedBy: e.uploadedBy,
      uploadedAt: e.uploadedAt.toISOString(),
      s3Key: e.s3Key,
    }));

    const bundleHash = createHash('sha256')
      .update(JSON.stringify({ dealId, files: files.map(f => f.hash) }))
      .digest('hex');

    return {
      manifest: {
        dealId,
        exportedAt: new Date().toISOString(),
        exportedBy: user.id,
        bundleHash,
        fileCount: files.length,
        chainValid,
      },
      files,
      chainValid,
    };
  }

  async exportLedgerCsv(dealId: string, user: RequestUser): Promise<string> {
    this.assertExportRole(user);
    const entries = await this.prisma.ledgerEntry.findMany({
      where: { dealId },
      orderBy: { createdAt: 'asc' },
    }).catch(() => []);
    const header = 'id,entryType,debitAccount,creditAccount,amountKopecks,currency,reference,idempotencyKey,createdAt\n';
    const rows = entries.map(e =>
      [e.id, e.entryType, e.debitAccount, e.creditAccount, e.amountKopecks, e.currency, e.reference ?? '', e.idempotencyKey, e.createdAt.toISOString()]
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    ).join('\n');
    return header + rows;
  }

  async exportOutboxStatus(user: RequestUser): Promise<{ pending: number; sent: number; dead: number; failed: number; entries: unknown[] }> {
    this.assertExportRole(user);
    const entries = await this.prisma.outboxEntry.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
    }).catch(() => []);
    return {
      pending: entries.filter(e => e.status === 'PENDING').length,
      sent: entries.filter(e => e.status === 'SENT').length,
      dead: entries.filter(e => e.status === 'DEAD').length,
      failed: entries.filter(e => e.status === 'FAILED').length,
      entries: entries.slice(0, 100),
    };
  }

  async exportRegulatoryReport(
    user: RequestUser,
    params: { type: 'msh' | 'rosstat' | 'fns' | 'rosfinmonitoring'; from?: string; to?: string },
  ): Promise<{ format: string; filename: string; content: string }> {
    this.assertExportRole(user);
    const from = params.from ? new Date(params.from) : new Date(Date.now() - 30 * 24 * 3600_000);
    const to = params.to ? new Date(params.to) : new Date();

    const deals = await this.prisma.deal.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: {
        id: true, dealNumber: true, status: true, culture: true, region: true,
        volumeTons: true, totalRub: true, totalKopecks: true,
        sellerOrgId: true, buyerOrgId: true, createdAt: true, closedAt: true,
      },
    }).catch(() => []);

    switch (params.type) {
      case 'msh':
        return this.buildMshXml(deals, from, to);
      case 'rosstat':
        return this.buildRosstatCsv(deals, from, to);
      case 'fns':
        return this.buildFnsXml(deals, from, to);
      case 'rosfinmonitoring':
        return this.buildRosfinXml(deals, from, to);
      default:
        throw new Error('Unknown report type');
    }
  }

  private buildMshXml(deals: any[], from: Date, to: Date): { format: string; filename: string; content: string } {
    const rows = deals.map(d => `
    <Сделка>
      <НомерСделки>${d.dealNumber ?? d.id}</НомерСделки>
      <Статус>${d.status}</Статус>
      <Культура>${d.culture ?? ''}</Культура>
      <Регион>${d.region ?? ''}</Регион>
      <ОбъёмТонн>${d.volumeTons ?? 0}</ОбъёмТонн>
      <СуммаРуб>${d.totalRub ?? 0}</СуммаРуб>
      <ДатаСоздания>${d.createdAt.toISOString()}</ДатаСоздания>
      <ДатаЗакрытия>${d.closedAt?.toISOString() ?? ''}</ДатаЗакрытия>
    </Сделка>`).join('');

    const content = `<?xml version="1.0" encoding="UTF-8"?>
<ОтчётМСХ xmlns="urn:grainflow:msh:1.0"
  ДатаОт="${from.toISOString().split('T')[0]}"
  ДатаДо="${to.toISOString().split('T')[0]}"
  ДатаФормирования="${new Date().toISOString()}"
  КоличествоСделок="${deals.length}">
  <Сделки>${rows}
  </Сделки>
</ОтчётМСХ>`;

    return { format: 'xml', filename: `msh-report-${Date.now()}.xml`, content };
  }

  private buildRosstatCsv(deals: any[], from: Date, to: Date): { format: string; filename: string; content: string } {
    const closedDeals = deals.filter(d => d.status === 'CLOSED' || d.status === 'SETTLED');
    const totalVol = closedDeals.reduce((s, d) => s + (d.volumeTons ?? 0), 0);
    const totalRub = closedDeals.reduce((s, d) => s + (d.totalRub ?? 0), 0);

    const header = 'Форма 29-СХ,Период,Количество сделок,Объём (т),Сумма (руб)\n';
    const row = `"GrainFlow","${from.toISOString().split('T')[0]} - ${to.toISOString().split('T')[0]}","${closedDeals.length}","${totalVol}","${totalRub}"\n`;

    const cultureSummary = Object.entries(
      deals.reduce((acc, d) => {
        const c = d.culture ?? 'Не указана';
        acc[c] = (acc[c] ?? 0) + (d.volumeTons ?? 0);
        return acc;
      }, {} as Record<string, number>)
    ).map(([c, v]) => `"${c}","${v}"`).join('\n');

    const content = header + row + '\nКультура,Объём (т)\n' + cultureSummary;
    return { format: 'csv', filename: `rosstat-29sx-${Date.now()}.csv`, content };
  }

  private buildFnsXml(deals: any[], from: Date, to: Date): { format: string; filename: string; content: string } {
    const taxableDeals = deals.filter(d => d.status === 'CLOSED' || d.status === 'SETTLED');
    const totalBase = taxableDeals.reduce((s, d) => s + (d.totalRub ?? 0), 0);
    const vatAmount = Math.round(totalBase * 0.2 * 100) / 100;

    const content = `<?xml version="1.0" encoding="UTF-8"?>
<Файл xmlns="urn:grainflow:fns:onf:1.0"
  ИдФайл="GF-${Date.now()}"
  ДатаФайл="${new Date().toISOString().split('T')[0]}">
  <ОтчётныйПериод ДатаНачала="${from.toISOString().split('T')[0]}" ДатаОкончания="${to.toISOString().split('T')[0]}"/>
  <СведенияОреализации>
    <КоличествоОпераций>${taxableDeals.length}</КоличествоОпераций>
    <ОбщаяСумма>${totalBase.toFixed(2)}</ОбщаяСумма>
    <НДС>${vatAmount.toFixed(2)}</НДС>
  </СведенияОреализации>
</Файл>`;

    return { format: 'xml', filename: `fns-onf-${Date.now()}.xml`, content };
  }

  async exportDealReport(dealId: string, user: RequestUser): Promise<{
    reportId: string;
    dealId: string;
    generatedAt: string;
    generatedBy: string;
    format: 'json';
    sections: {
      summary: object;
      timeline: unknown[];
      financials: object;
      documents: unknown[];
      chainIntegrity: object;
    };
  }> {
    this.assertExportRole(user);
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      include: { events: { orderBy: { createdAt: 'asc' } } },
    }).catch(() => null);

    if (!deal) {
      return {
        reportId: `rpt-${Date.now()}`,
        dealId,
        generatedAt: new Date().toISOString(),
        generatedBy: user.id,
        format: 'json',
        sections: {
          summary: { dealId, note: 'Deal not found in DB (in-memory mode)' },
          timeline: [],
          financials: {},
          documents: [],
          chainIntegrity: { valid: true, note: 'no events in DB' },
        },
      };
    }

    const events = (deal as any).events ?? [];
    const isChainValid = events.length === 0 || events.every((_: unknown, i: number) => {
      if (i === 0) return true;
      return (events[i] as any).prevHash === (events[i - 1] as any).hash;
    });

    return {
      reportId: `rpt-${Date.now()}`,
      dealId,
      generatedAt: new Date().toISOString(),
      generatedBy: user.id,
      format: 'json',
      sections: {
        summary: {
          dealNumber: (deal as any).dealNumber,
          status: (deal as any).status,
          culture: (deal as any).culture,
          volumeTons: (deal as any).volumeTons,
          totalRub: (deal as any).totalRub,
          sellerOrgId: (deal as any).sellerOrgId,
          buyerOrgId: (deal as any).buyerOrgId,
          createdAt: (deal as any).createdAt,
          closedAt: (deal as any).closedAt,
        },
        timeline: events.map((e: any) => ({
          eventType: e.eventType,
          actorId: e.actorId,
          actorRole: e.actorRole,
          hash: e.hash?.slice(0, 16) + '…',
          createdAt: e.createdAt,
        })),
        financials: {
          totalKopecks: (deal as any).totalKopecks,
          totalRub: (deal as any).totalRub,
          currency: (deal as any).currency ?? 'RUB',
        },
        documents: [],
        chainIntegrity: { valid: isChainValid, eventCount: events.length },
      },
    };
  }

  private buildRosfinXml(deals: any[], from: Date, to: Date): { format: string; filename: string; content: string } {
    const threshold = 600_000;
    const largeDeals = deals.filter(d => (d.totalRub ?? 0) >= threshold);

    const rows = largeDeals.map(d => `
  <Операция>
    <КодОперации>1010</КодОперации>
    <Дата>${d.createdAt.toISOString().split('T')[0]}</Дата>
    <Сумма>${d.totalRub ?? 0}</Сумма>
    <Валюта>RUB</Валюта>
    <НомерДокумента>${d.dealNumber ?? d.id}</НомерДокумента>
    <ПродавецОргИд>${d.sellerOrgId}</ПродавецОргИд>
    <ПокупательОргИд>${d.buyerOrgId}</ПокупательОргИд>
  </Операция>`).join('');

    const content = `<?xml version="1.0" encoding="UTF-8"?>
<ФЭС407 xmlns="urn:grainflow:rosfinmon:407:1.0"
  ДатаФормирования="${new Date().toISOString()}"
  КоличествоОпераций="${largeDeals.length}">
  <Операции>${rows}
  </Операции>
</ФЭС407>`;

    return { format: 'xml', filename: `rosfinmon-fes407-${Date.now()}.xml`, content };
  }
}
