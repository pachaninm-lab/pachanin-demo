import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ArbitratorService } from './arbitrator.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/types/request-user';

@Controller('api/arbitrator')
@UseGuards(JwtAuthGuard)
export class ArbitratorController {
  constructor(private readonly arbitrator: ArbitratorService) {}

  @Get('disputes')
  getDisputes(@CurrentUser() user: RequestUser) {
    return this.arbitrator.getAssignedDisputes(user);
  }

  @Post('disputes/:id/assign')
  assignSelf(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.arbitrator.assignSelf(id, user);
  }

  @Get('disputes/:id/case')
  getCase(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.arbitrator.getDisputeCase(id, user);
  }

  @Patch('disputes/:id/note')
  addNote(@Param('id') id: string, @Body() body: { note: string }, @CurrentUser() user: RequestUser) {
    return this.arbitrator.addNote(id, body.note, user);
  }

  @Post('disputes/:id/resolve')
  resolve(
    @Param('id') id: string,
    @Body() body: {
      outcome: 'BUYER_WIN' | 'SELLER_WIN' | 'SPLIT' | 'NO_CLAIM' | 'CANCELLED';
      splitPct?: number;
      note?: string;
      commandId: string;
      idempotencyKey: string;
    },
    @CurrentUser() user: RequestUser,
  ) {
    return this.arbitrator.resolve(id, body, user);
  }
}
