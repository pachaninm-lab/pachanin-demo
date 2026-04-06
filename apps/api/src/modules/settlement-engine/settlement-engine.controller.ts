import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UseGuards } from '@nestjs/common';
import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SettlementEngineService } from './settlement-engine.service';

@UseGuards(RolesGuard)
@Roles('ACCOUNTING', 'SUPPORT_MANAGER')
@Controller('settlement-engine')
export class SettlementEngineController {
  constructor(private readonly settlementEngine: SettlementEngineService) {}

  @Get('deal/:id')
  async worksheet(@Param('id') id: string) {
    return this.settlementEngine.worksheet(id);
  }

  @Get('payments')
  async payments(@CurrentUser() user: any) {
    return this.settlementEngine.listPayments(user);
  }

  @Get('payments/:id')
  async paymentDetail(@Param('id') id: string, @CurrentUser() user: any) {
    return this.settlementEngine.paymentDetail(id, user);
  }

  @Get('export')
  async exportDeals(
    @Query('format') format: string | undefined,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @CurrentUser() user: any,
    @Res({ passthrough: true }) res: Response
  ) {
    const payload = await this.settlementEngine.exportDeals({ format, from, to }, user);
    res.setHeader('Content-Type', payload.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${payload.fileName}"`);
    return payload.body;
  }

  @Get('export/contractors')
  async exportContractors(@CurrentUser() user: any, @Res({ passthrough: true }) res: Response) {
    const payload = await this.settlementEngine.exportContractors(user);
    res.setHeader('Content-Type', payload.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${payload.fileName}"`);
    return payload.body;
  }

  @Post('deal/:id/confirm')
  async confirm(@Param('id') id: string, @CurrentUser() user: any) {
    return this.settlementEngine.confirmWorksheet(id, user);
  }

  @Post('deal/:id/release')
  async release(@Param('id') id: string, @CurrentUser() user: any) {
    return this.settlementEngine.releasePayment(id, user);
  }

  @Post('deal/:id/adjust')
  async adjust(@Param('id') id: string, @Body() body: { adjustments: any[] }, @CurrentUser() user: any) {
    return this.settlementEngine.adjustWorksheet(id, body.adjustments, user);
  }

  @Post('import-bank-statement')
  async importBankStatement(@Body() body: { content: string; format: string }, @CurrentUser() user: any) {
    return this.settlementEngine.importBankStatement(body.content, body.format, user);
  }
}
