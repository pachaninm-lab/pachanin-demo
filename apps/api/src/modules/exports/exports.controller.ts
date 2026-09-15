import { Controller, Get, Post, Query, Param, Body, UseGuards, Res } from '@nestjs/common';
import { Response } from 'express';
import { ExportsService } from './exports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/types/request-user';
import { attachmentDisposition } from '../../common/security/content-disposition';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';

// V2.4.1: every route here answers with a whole dataset rather than one
// record, which makes this the exfiltration surface - the place where repeated
// ordinary calls, each of them authorised, add up to the database. The limits
// are per user rather than per IP: the caller is authenticated, so the account
// is the thing worth bounding, and one account behind many addresses would walk
// past an IP bound. The global RateLimitGuard reads this metadata and fails
// closed if the limiter itself is unavailable.
@Controller('api/exports')
@UseGuards(JwtAuthGuard)
export class ExportsController {
  constructor(private readonly exports: ExportsService) {}

  @RateLimit({
    name: 'exports_deals',
    scope: 'user',
    limit: 6,
    windowSeconds: 300,
    limitEnv: 'RATE_LIMIT_EXPORTS_DEALS',
    windowEnv: 'RATE_LIMIT_EXPORTS_DEALS_WINDOW_SECONDS',
  })
  @Get('deals')
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

  @RateLimit({
    name: 'exports_evidence',
    scope: 'user',
    limit: 20,
    windowSeconds: 300,
    limitEnv: 'RATE_LIMIT_EXPORTS_EVIDENCE',
    windowEnv: 'RATE_LIMIT_EXPORTS_EVIDENCE_WINDOW_SECONDS',
    includeParams: ['dealId'],
  })
  @Get('evidence/:dealId')
  exportEvidence(@Param('dealId') dealId: string, @CurrentUser() user: RequestUser) {
    return this.exports.exportEvidenceBundle(dealId, user);
  }

  @RateLimit({
    name: 'exports_ledger',
    scope: 'user',
    limit: 20,
    windowSeconds: 300,
    limitEnv: 'RATE_LIMIT_EXPORTS_LEDGER',
    windowEnv: 'RATE_LIMIT_EXPORTS_LEDGER_WINDOW_SECONDS',
    includeParams: ['dealId'],
  })
  @Get('ledger/:dealId')
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

  @RateLimit({
    name: 'exports_outbox_status',
    scope: 'user',
    limit: 30,
    windowSeconds: 300,
    limitEnv: 'RATE_LIMIT_EXPORTS_OUTBOX_STATUS',
    windowEnv: 'RATE_LIMIT_EXPORTS_OUTBOX_STATUS_WINDOW_SECONDS',
  })
  @Get('outbox-status')
  exportOutboxStatus(@CurrentUser() user: RequestUser) {
    return this.exports.exportOutboxStatus(user);
  }

  @RateLimit({
    name: 'exports_deal_report',
    scope: 'user',
    limit: 20,
    windowSeconds: 300,
    limitEnv: 'RATE_LIMIT_EXPORTS_DEAL_REPORT',
    windowEnv: 'RATE_LIMIT_EXPORTS_DEAL_REPORT_WINDOW_SECONDS',
    includeParams: ['dealId'],
  })
  @Get('deal-report/:dealId')
  getDealReport(@Param('dealId') dealId: string, @CurrentUser() user: RequestUser) {
    return this.exports.exportDealReport(dealId, user);
  }

  @RateLimit({
    name: 'exports_regulatory',
    scope: 'user',
    limit: 5,
    windowSeconds: 3600,
    limitEnv: 'RATE_LIMIT_EXPORTS_REGULATORY',
    windowEnv: 'RATE_LIMIT_EXPORTS_REGULATORY_WINDOW_SECONDS',
  })
  @Post('regulatory')
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
