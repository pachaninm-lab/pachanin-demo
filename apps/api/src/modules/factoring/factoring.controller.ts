import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser, Role } from '../../common/types/request-user';
import { FactoringService } from './factoring.service';
import { ForbiddenException } from '@nestjs/common';

const OVERDUE_CHECK_ROLES: ReadonlySet<Role> = new Set([Role.ADMIN, Role.ACCOUNTING]);

@Controller('api/factoring')
@UseGuards(JwtAuthGuard)
export class FactoringController {
  constructor(private readonly factoring: FactoringService) {}

  @Get('factors')
  listFactors() {
    return { factors: this.factoring.listFactors() };
  }

  @Post('applications')
  createApplication(
    @Body() body: { dealId: string; organizationId: string; factorName: string; requestedAmountKopecks: number },
    @CurrentUser() user: RequestUser,
  ) {
    return this.factoring.createApplication(body, user);
  }

  @Get('applications')
  list(@CurrentUser() user: RequestUser) {
    return { items: this.factoring.list(user) };
  }

  @Get('applications/:id')
  getOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.factoring.getOne(id, user);
  }

  @Get('applications/:id/score')
  async score(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    const app = this.factoring.getOne(id, user);
    return { applicationId: app.id, platformScore: app.platformScore, details: app.scoringDetails };
  }

  @Post('applications/:id/activate')
  activate(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.factoring.markActive(id, user);
  }

  @Post('applications/:id/repay')
  repay(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.factoring.markRepaid(id, user);
  }

  @Get('credit-report/:organizationId')
  getCreditReport(@Param('organizationId') organizationId: string, @CurrentUser() user: RequestUser) {
    return this.factoring.getCreditReport(organizationId, user);
  }

  @Get('org-block-status/:organizationId')
  getOrgBlockStatus(@Param('organizationId') organizationId: string) {
    return {
      organizationId,
      blocked: this.factoring.isOrganizationBlocked(organizationId),
    };
  }

  @Post('check-overdue')
  checkOverdue(@CurrentUser() user: RequestUser) {
    if (!OVERDUE_CHECK_ROLES.has(user.role)) {
      throw new ForbiddenException('Только ADMIN/ACCOUNTING');
    }
    return this.factoring.checkOverdue();
  }
}
