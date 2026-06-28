import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/types/request-user';
import { SupportService, TicketPriority } from './support.service';

@Controller('api/support')
@UseGuards(JwtAuthGuard)
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Post('tickets')
  createTicket(
    @Body() body: { subject: string; description: string; category: string; priority?: TicketPriority; dealId?: string; organizationId?: string },
    @CurrentUser() user: RequestUser,
  ) {
    return this.support.createTicket(body, user);
  }

  @Get('tickets')
  listQueue(
    @CurrentUser() user: RequestUser,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('assignedTo') assignedTo?: string,
  ) {
    return { items: this.support.listQueue(user, { status, priority, assignedTo }) };
  }

  @Get('tickets/stats')
  stats(@CurrentUser() user: RequestUser) {
    return this.support.getStats(user);
  }

  @Get('tickets/:id')
  getTicket(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.support.getTicket(id, user);
  }

  @Patch('tickets/:id/assign')
  assign(
    @Param('id') id: string,
    @Body() body: { assigneeId: string },
    @CurrentUser() user: RequestUser,
  ) {
    return this.support.assignTicket(id, body.assigneeId, user);
  }

  @Patch('tickets/:id/resolve')
  resolve(
    @Param('id') id: string,
    @Body() body: { resolution: string },
    @CurrentUser() user: RequestUser,
  ) {
    return this.support.resolveTicket(id, body.resolution, user);
  }

  @Patch('tickets/:id/escalate')
  escalate(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @CurrentUser() user: RequestUser,
  ) {
    return this.support.escalateTicket(id, body.reason, user);
  }

  @Post('tickets/:id/comments')
  addComment(
    @Param('id') id: string,
    @Body() body: { text: string; isInternal?: boolean },
    @CurrentUser() user: RequestUser,
  ) {
    return this.support.addComment(id, body.text, user, body.isInternal);
  }

  @Get('deals/:dealId')
  viewDeal(@Param('dealId') dealId: string, @CurrentUser() user: RequestUser) {
    return this.support.viewDealReadOnly(dealId, user);
  }

  @Post('users/:userId/reset-password')
  resetPassword(@Param('userId') userId: string, @CurrentUser() user: RequestUser) {
    return this.support.resetUserPassword(userId, user);
  }
}
