import { Body, Controller, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ComplianceService } from './compliance.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/types/request-user';

@Controller('api/compliance')
@UseGuards(JwtAuthGuard)
export class ComplianceController {
  constructor(private readonly compliance: ComplianceService) {}

  @Get('kyc-queue')
  getKycQueue(@CurrentUser() user: RequestUser, @Query('status') status?: string) {
    return this.compliance.getKycQueue(user, status);
  }

  @Patch('kyc-queue/:id/assign')
  assignKycTask(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.compliance.assignKycTask(id, user);
  }

  @Patch('kyc-queue/:id/resolve')
  resolveKycTask(
    @Param('id') id: string,
    @Body() body: { status: 'APPROVED' | 'REJECTED'; notes?: string },
    @CurrentUser() user: RequestUser,
  ) {
    return this.compliance.resolveKycTask(id, body, user);
  }

  @Get('sanction-flags')
  getSanctionFlags(@CurrentUser() user: RequestUser) {
    return this.compliance.getSanctionFlags(user);
  }

  @Post('block-org/:orgId')
  blockOrg(
    @Param('orgId') orgId: string,
    @Body() body: { reason: string },
    @CurrentUser() user: RequestUser,
  ) {
    return this.compliance.blockOrganization(orgId, body.reason, user);
  }

  @Get('audit-log')
  getAuditLog(
    @CurrentUser() user: RequestUser,
    @Query('dealId') dealId?: string,
    @Query('actorId') actorId?: string,
    @Query('action') action?: string,
    @Query('limit') limit?: string,
  ) {
    return this.compliance.getAuditLog(user, { dealId, actorId, action, limit: limit ? Number(limit) : undefined });
  }

  @Get('audit-log/export')
  async exportAuditCsv(
    @CurrentUser() user: RequestUser,
    @Query('dealId') dealId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Res() res: Response,
  ) {
    const csv = await this.compliance.exportAuditCsv(user, { dealId, from, to });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit-${Date.now()}.csv"`);
    res.send(csv);
  }

  @Get('integrations/status')
  getIntegrationStatus(@CurrentUser() user: RequestUser) {
    return this.compliance.getIntegrationStatus(user);
  }

  /** Список регуляторных отчётов (ТЗ 12.3) */
  @Get('regulatory-reports')
  listRegulatoryReports(@CurrentUser() user: RequestUser) {
    return this.compliance.listRegulatoryReports(user);
  }

  /** Генерация регуляторного отчёта (ТЗ 12.3) */
  @Post('regulatory-reports/generate')
  generateRegulatoryReport(
    @Body() body: { reportType: string; period?: string; from?: string; to?: string },
    @CurrentUser() user: RequestUser,
  ) {
    return this.compliance.generateRegulatoryReport(body.reportType, body, user);
  }
}
