import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/types/request-user';
import { FactoringService } from './factoring.service';

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
}
