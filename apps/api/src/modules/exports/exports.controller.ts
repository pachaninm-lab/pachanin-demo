import { Controller, Get, Post, Query, Param, Body, UseGuards, Res } from '@nestjs/common';
import { Response } from 'express';
import { ExportsService } from './exports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/types/request-user';

@Controller('api/exports')
@UseGuards(JwtAuthGuard)
export class ExportsController {
  constructor(private readonly exports: ExportsService) {}

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
    res!.setHeader('Content-Disposition', `attachment; filename="deals-${Date.now()}.csv"`);
    res!.send(csv);
  }

  @Get('evidence/:dealId')
  exportEvidence(@Param('dealId') dealId: string, @CurrentUser() user: RequestUser) {
    return this.exports.exportEvidenceBundle(dealId, user);
  }

  @Get('ledger/:dealId')
  async exportLedger(
    @Param('dealId') dealId: string,
    @CurrentUser() user: RequestUser,
    @Res() res: Response,
  ) {
    const csv = await this.exports.exportLedgerCsv(dealId, user);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="ledger-${dealId}-${Date.now()}.csv"`);
    res.send(csv);
  }

  @Get('outbox-status')
  exportOutboxStatus(@CurrentUser() user: RequestUser) {
    return this.exports.exportOutboxStatus(user);
  }

  @Post('regulatory')
  async regulatoryReport(
    @Body() body: { type: 'msh' | 'rosstat' | 'fns' | 'rosfinmonitoring'; from?: string; to?: string },
    @CurrentUser() user: RequestUser,
    @Res() res: Response,
  ) {
    const result = await this.exports.exportRegulatoryReport(user, body);
    const mime = result.format === 'xml' ? 'application/xml' : 'text/csv';
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.content);
  }
}
