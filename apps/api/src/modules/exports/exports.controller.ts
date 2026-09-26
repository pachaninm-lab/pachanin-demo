import { Controller, Get, Post, Query, Param, Body, UseGuards, Res } from '@nestjs/common';
import { Response } from 'express';
import { ExportsService } from './exports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/types/request-user';
import { attachmentDisposition } from '../../common/security/content-disposition';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';

/**
 * ASVS 5.0 V2.4.1: на выгрузках стоит ограничение частоты.
 *
 * Аутентификация и несколько маршрутов сделок были ограничены и раньше, а
 * массовые выгрузки — нет, притом что именно они и есть поверхность
 * эксфильтрации: exportDealsCsv отдаёт до 10 000 сделок тенанта одним
 * запросом. nginx объявляет зоны limit_req, но на эту конфигурацию не
 * ссылается ни один файл развёртывания в репозитории, поэтому показать её
 * действие нельзя, и опираться на неё как на контроль нельзя тоже.
 *
 * Область — 'user', а не 'ip': ограничивается действующее лицо, а не сетевой
 * адрес. Учётная запись, уводящая данные, остаётся одной и той же при смене
 * адреса, тогда как за одним адресом законно работает целый офис.
 *
 * Пределы соразмерны цене запроса: разовый отчёт по сделке дешевле полной
 * выгрузки реестра, а государственная форма — самая дорогая из всех.
 */
@Controller('api/exports')
@UseGuards(JwtAuthGuard)
export class ExportsController {
  constructor(private readonly exports: ExportsService) {}

  @Get('deals')
  @RateLimit({ name: 'exports_deals', scope: 'user', limit: 10, windowSeconds: 300, limitEnv: 'RATE_LIMIT_EXPORTS_DEALS', windowEnv: 'RATE_LIMIT_EXPORTS_WINDOW_SECONDS' })
  async exportDeals(
    @CurrentUser() user: RequestUser,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Res() res?: Response,
  ) {
    const csv = await this.exports.exportDealsCsv(user, { status, from, to });
    res!.setHeader('Content-Type', 'text/csv');
    res!.setHeader('Content-Disposition', attachmentDisposition(`deals-${Date.now()}.csv`));
    res!.send(csv);
  }

  @Get('evidence/:dealId')
  @RateLimit({ name: 'exports_evidence', scope: 'user', limit: 30, windowSeconds: 300, limitEnv: 'RATE_LIMIT_EXPORTS_EVIDENCE', windowEnv: 'RATE_LIMIT_EXPORTS_WINDOW_SECONDS' })
  exportEvidence(@Param('dealId') dealId: string, @CurrentUser() user: RequestUser) {
    return this.exports.exportEvidenceBundle(dealId, user);
  }

  @Get('ledger/:dealId')
  @RateLimit({ name: 'exports_ledger', scope: 'user', limit: 30, windowSeconds: 300, limitEnv: 'RATE_LIMIT_EXPORTS_LEDGER', windowEnv: 'RATE_LIMIT_EXPORTS_WINDOW_SECONDS' })
  async exportLedger(
    @Param('dealId') dealId: string,
    @CurrentUser() user: RequestUser,
    @Res() res: Response,
  ) {
    const csv = await this.exports.exportLedgerCsv(dealId, user);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', attachmentDisposition(`ledger-${dealId}-${Date.now()}.csv`));
    res.send(csv);
  }

  @Get('outbox-status')
  @RateLimit({ name: 'exports_outbox_status', scope: 'user', limit: 30, windowSeconds: 300, limitEnv: 'RATE_LIMIT_EXPORTS_OUTBOX', windowEnv: 'RATE_LIMIT_EXPORTS_WINDOW_SECONDS' })
  exportOutboxStatus(@CurrentUser() user: RequestUser) {
    return this.exports.exportOutboxStatus(user);
  }

  @Get('deal-report/:dealId')
  @RateLimit({ name: 'exports_deal_report', scope: 'user', limit: 30, windowSeconds: 300, limitEnv: 'RATE_LIMIT_EXPORTS_DEAL_REPORT', windowEnv: 'RATE_LIMIT_EXPORTS_WINDOW_SECONDS' })
  getDealReport(@Param('dealId') dealId: string, @CurrentUser() user: RequestUser) {
    return this.exports.exportDealReport(dealId, user);
  }

  @Post('regulatory')
  @RateLimit({ name: 'exports_regulatory', scope: 'user', limit: 5, windowSeconds: 900, limitEnv: 'RATE_LIMIT_EXPORTS_REGULATORY', windowEnv: 'RATE_LIMIT_EXPORTS_REGULATORY_WINDOW_SECONDS' })
  async regulatoryReport(
    @Body() body: { type: 'msh' | 'rosstat' | 'fns' | 'rosfinmonitoring'; from?: string; to?: string },
    @CurrentUser() user: RequestUser,
    @Res() res: Response,
  ) {
    const result = await this.exports.exportRegulatoryReport(user, body);
    const mime = result.format === 'xml' ? 'application/xml' : 'text/csv';
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', attachmentDisposition(result.filename));
    res.send(result.content);
  }
}
