import { Injectable, ForbiddenException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestUser, Role } from '../../common/types/request-user';
import { xmlAttribute, xmlText } from '../../common/security/xml-escape';
import { csvRow } from '../../common/security/csv-cell';

const EXPORT_ALLOWED_ROLES: Role[] = [Role.ADMIN, Role.COMPLIANCE_OFFICER, Role.ACCOUNTING, Role.EXECUTIVE];

@Injectable()
export class ExportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Тенант вызывающего — обязателен, а не желателен.
   *
   * Замер на живой базе (#4839): под ролью приложения `app_runtime`
   * (NOSUPERUSER, NOBYPASSRLS) и без выставленного RLS-контекста запрос без
   * предиката тенанта вернул сделки обоих тенантов. Причина — permissive-
   * политика, которая по правилам PostgreSQL объединяется с строгой
   * `deals_select` через OR и обесценивает её.
   *
   * Имя политики с тех пор изменилось, вывод — нет. `deals_app_access
   * USING (true)` снята миграцией 20260831180000; на её месте
   * `deals_uncontexted_read ON public."deals" FOR SELECT USING (TRUE)`, и её
   * собственный COMMENT называет причину, по которой она ещё жива: «while the
   * export and analytics readers still run outside an RLS context» (#4814).
   * То есть читатель этого файла и есть та причина. Пока он читает без
   * контекста, единственная граница на этом пути — вот эта.
   *
   * Отсутствующий tenantId не «пропускаем дальше»: это отказ. Иначе
   * пользователь без тенанта в токене получил бы ровно то чтение, которое здесь
   * и закрывается. Та же форма проверки стоит в
   * postgresql-deal-command.service.ts.
   */
  private assertTenantScope(user: RequestUser): string {
    const tenantId = user.tenantId;
    if (typeof tenantId !== 'string' || tenantId.length === 0) {
      throw new ForbiddenException('Export tenant scope unavailable');
    }
    return tenantId;
  }

  private assertExportRole(user: RequestUser): void {
    if (!EXPORT_ALLOWED_ROLES.includes(user.role as Role)) {
      throw new ForbiddenException('Export access denied');
    }
  }

  async exportDealsCsv(user: RequestUser, filters?: { status?: string; from?: string; to?: string }): Promise<string> {
    this.assertExportRole(user);
    const tenantId = this.assertTenantScope(user);
    const deals = await this.prisma.deal.findMany({
      where: {
        tenantId,
        ...(filters?.status && { status: filters.status }),
        ...(filters?.from && { createdAt: { gte: new Date(filters.from) } }),
        ...(filters?.to && { createdAt: { lte: new Date(filters.to) } }),
      },
      orderBy: { createdAt: 'desc' },
      take: 10000,
    });
    const header = 'id,dealNumber,status,sellerOrgId,buyerOrgId,culture,cropClass,volumeTons,totalRub,currency,region,createdAt,closedAt\n';
    const rows = deals.map(d =>
      csvRow([d.id, d.dealNumber ?? '', d.status, d.sellerOrgId, d.buyerOrgId, d.culture ?? '', d.cropClass ?? '', d.volumeTons ?? '', d.totalRub ?? '', d.currency, d.region ?? '', d.createdAt.toISOString(), d.closedAt?.toISOString() ?? ''])
    ).join('\n');
    return header + rows;
  }

  async exportEvidenceBundle(dealId: string, user: RequestUser): Promise<{
    manifest: object;
    files: Array<{ filename: string; hash: string; prevHash: string | null; type: string; uploadedAt: string }>;
    chainValid: boolean;
  }> {
    // Роль проверяется первой, как и у пяти остальных выгрузок. Здесь этой
    // проверки не было вовсе: контроллер закрыт только JwtAuthGuard, роль
    // держится исключительно на сервисе, и связка давала любому
    // аутентифицированному пользователю тенанта полный комплект доказательств
    // по ЛЮБОЙ сделке этого тенанта - вместе с s3Key каждого файла, - тогда как
    // соседняя exportLedgerCsv тому же вызывающему отказывает.
    //
    // Замерено, а не выведено из чтения: под DRIVER и под FARMER метод вернул
    // файл и его s3Key, а exportLedgerCsv под DRIVER - Export access denied.
    //
    // Участие в сделке здесь не проверяется и не проверялось: границей был один
    // лишь тенант. Поэтому "доказательства доступны участникам" эту связку не
    // описывало даже до правки.
    this.assertExportRole(user);
    const tenantId = this.assertTenantScope(user);
    // findFirst с предикатом тенанта, а не findUnique по id: чужая сделка
    // должна быть неотличима от несуществующей.
    const deal = await this.prisma.deal.findFirst({ where: { id: dealId, tenantId } });
    if (!deal) throw new ForbiddenException(`Deal ${dealId} not found`);

    const evidence = await this.prisma.evidenceFile.findMany({
      where: { dealId },
      orderBy: { uploadedAt: 'asc' },
    });

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
    const tenantId = this.assertTenantScope(user);
    // ledger_entries своей колонки тенанта не имеет, поэтому принадлежность
    // проверяется по сделке. Строки RLS всё равно не отдаст, пока контекст не
    // выставлен, - но полагаться на это как на границу нельзя: контрол,
    // держащийся на том, что запрос и так ничего не вернёт, не контрол.
    const deal = await this.prisma.deal.findFirst({
      where: { id: dealId, tenantId },
      select: { id: true },
    });
    if (!deal) throw new ForbiddenException(`Deal ${dealId} not found`);
    // Без .catch(() => []): отказ запроса давал заголовок без строк, то есть
    // CSV, утверждающий «проводок по сделке нет», когда база их просто не
    // отдала. Пустая выгрузка и неудавшаяся выгрузка обязаны различаться.
    const entries = await this.prisma.ledgerEntry.findMany({
      where: { dealId },
      orderBy: { createdAt: 'asc' },
    });
    const header = 'id,entryType,debitAccount,creditAccount,amountKopecks,currency,reference,idempotencyKey,createdAt\n';
    const rows = entries.map(e =>
      csvRow([e.id, e.entryType, e.debitAccount, e.creditAccount, e.amountKopecks, e.currency, e.reference ?? '', e.idempotencyKey, e.createdAt.toISOString()])
    ).join('\n');
    return header + rows;
  }

  async exportOutboxStatus(user: RequestUser): Promise<{ pending: number; sent: number; dead: number; failed: number; entries: unknown[] }> {
    this.assertExportRole(user);
    const tenantId = this.assertTenantScope(user);
    // Пятая из шести выгрузок жила без границы вовсе: ни assertTenantScope, ни
    // предиката в запросе - чтение шло по всей таблице outbox_entries, и наружу
    // уходила строка целиком, вместе с payload события и leaseToken воркера
    // доставки.
    //
    // У outbox_entries своей колонки тенанта нет: принадлежность записи
    // определяется её сделкой. Запись без сделки не принадлежит ни одному
    // тенанту и в tenant-scoped выгрузку не попадает - ровно это уже делает
    // строгая политика outbox_entries_select, требующая "dealId" IS NOT NULL.
    //
    // На RLS здесь опереться нельзя: соседняя outbox_entries_worker_select -
    // USING (current_user IN ('app_service', 'app_outbox')) без тенанта вовсе, -
    // permissive, а permissive-политики PostgreSQL объединяет через OR. Под
    // сервисным принципалом база отдаёт таблицу целиком. Скоуп по сделкам
    // тенанта - та же форма, что уже стоит в staff-workspace.service.ts.
    const scopedDealIds = (await this.prisma.deal.findMany({
      where: { tenantId },
      select: { id: true },
    })).map((deal) => deal.id);

    const entries = await this.prisma.outboxEntry.findMany({
      where: { dealId: { in: scopedDealIds } },
      // Явный список полей, а не строка целиком. payload несёт содержимое
      // события, leaseToken - уникальный маркер аренды воркера доставки; в
      // статусной выгрузке не нужно ни то, ни другое.
      select: {
        id: true,
        type: true,
        dealId: true,
        status: true,
        retryCount: true,
        maxRetries: true,
        nextRetryAt: true,
        lastError: true,
        correlationId: true,
        createdAt: true,
        sentAt: true,
        confirmedAt: true,
        failedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
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
    const tenantId = this.assertTenantScope(user);
    const from = params.from ? new Date(params.from) : new Date(Date.now() - 30 * 24 * 3600_000);
    const to = params.to ? new Date(params.to) : new Date();

    // Это единственная выгрузка, уходящая наружу - в МСХ, Росстат, ФНС и
    // Росфинмониторинг. С .catch(() => []) отказ запроса превращался в
    // отчётность за период с нулём операций и нулевой суммой: не пустой отчёт,
    // а ложное донесение регулятору. Отказ обязан быть отказом.
    const deals = await this.prisma.deal.findMany({
      where: { tenantId, createdAt: { gte: from, lte: to } },
      select: {
        id: true, dealNumber: true, status: true, culture: true, region: true,
        volumeTons: true, totalRub: true, totalKopecks: true,
        sellerOrgId: true, buyerOrgId: true, createdAt: true, closedAt: true,
      },
    });

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
      <НомерСделки>${xmlText(d.dealNumber ?? d.id)}</НомерСделки>
      <Статус>${xmlText(d.status)}</Статус>
      <Культура>${xmlText(d.culture)}</Культура>
      <Регион>${xmlText(d.region)}</Регион>
      <ОбъёмТонн>${xmlText(d.volumeTons ?? 0)}</ОбъёмТонн>
      <СуммаРуб>${xmlText(d.totalRub ?? 0)}</СуммаРуб>
      <ДатаСоздания>${xmlText(d.createdAt.toISOString())}</ДатаСоздания>
      <ДатаЗакрытия>${xmlText(d.closedAt?.toISOString())}</ДатаЗакрытия>
    </Сделка>`).join('');

    const content = `<?xml version="1.0" encoding="UTF-8"?>
<ОтчётМСХ xmlns="urn:grainflow:msh:1.0"
  ДатаОт="${xmlAttribute(from.toISOString().split('T')[0])}"
  ДатаДо="${xmlAttribute(to.toISOString().split('T')[0])}"
  ДатаФормирования="${xmlAttribute(new Date().toISOString())}"
  КоличествоСделок="${xmlAttribute(deals.length)}">
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
    const row = `${csvRow(['GrainFlow', `${from.toISOString().split('T')[0]} - ${to.toISOString().split('T')[0]}`, closedDeals.length, totalVol, totalRub])}\n`;

    const cultureSummary = Object.entries(
      deals.reduce((acc, d) => {
        const c = d.culture ?? 'Не указана';
        acc[c] = (acc[c] ?? 0) + (d.volumeTons ?? 0);
        return acc;
      }, {} as Record<string, number>)
    ).map(([c, v]) => csvRow([c, v])).join('\n');

    const content = header + row + '\nКультура,Объём (т)\n' + cultureSummary;
    return { format: 'csv', filename: `rosstat-29sx-${Date.now()}.csv`, content };
  }

  private buildFnsXml(deals: any[], from: Date, to: Date): { format: string; filename: string; content: string } {
    const taxableDeals = deals.filter(d => d.status === 'CLOSED' || d.status === 'SETTLED');
    const totalBase = taxableDeals.reduce((s, d) => s + (d.totalRub ?? 0), 0);
    const vatAmount = Math.round(totalBase * 0.2 * 100) / 100;

    const content = `<?xml version="1.0" encoding="UTF-8"?>
<Файл xmlns="urn:grainflow:fns:onf:1.0"
  ИдФайл="GF-${xmlAttribute(Date.now())}"
  ДатаФайл="${xmlAttribute(new Date().toISOString().split('T')[0])}">
  <ОтчётныйПериод ДатаНачала="${xmlAttribute(from.toISOString().split('T')[0])}" ДатаОкончания="${xmlAttribute(to.toISOString().split('T')[0])}"/>
  <СведенияОреализации>
    <КоличествоОпераций>${xmlText(taxableDeals.length)}</КоличествоОпераций>
    <ОбщаяСумма>${xmlText(totalBase.toFixed(2))}</ОбщаяСумма>
    <НДС>${xmlText(vatAmount.toFixed(2))}</НДС>
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
    // Здесь .catch(() => null) был хуже пустого результата: он уводил в ветку
    // ниже, а та возвращает отчёт с chainIntegrity: { valid: true }. То есть
    // при недоступной базе метод выдавал утверждение о целостности цепочки
    // событий, которую не читал. Ветка «сделки нет» остаётся - но только для
    // случая, когда база ответила и сделки действительно нет.
    const deal = await this.prisma.deal.findFirst({
      where: { id: dealId, tenantId: this.assertTenantScope(user) },
      include: { dealEvents: { orderBy: { createdAt: 'asc' } } },
    });

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

    const events = (deal as any).dealEvents ?? [];
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
    <Дата>${xmlText(d.createdAt.toISOString().split('T')[0])}</Дата>
    <Сумма>${xmlText(d.totalRub ?? 0)}</Сумма>
    <Валюта>RUB</Валюта>
    <НомерДокумента>${xmlText(d.dealNumber ?? d.id)}</НомерДокумента>
    <ПродавецОргИд>${xmlText(d.sellerOrgId)}</ПродавецОргИд>
    <ПокупательОргИд>${xmlText(d.buyerOrgId)}</ПокупательОргИд>
  </Операция>`).join('');

    const content = `<?xml version="1.0" encoding="UTF-8"?>
<ФЭС407 xmlns="urn:grainflow:rosfinmon:407:1.0"
  ДатаФормирования="${xmlAttribute(new Date().toISOString())}"
  КоличествоОпераций="${xmlAttribute(largeDeals.length)}">
  <Операции>${rows}
  </Операции>
</ФЭС407>`;

    return { format: 'xml', filename: `rosfinmon-fes407-${Date.now()}.xml`, content };
  }
}
