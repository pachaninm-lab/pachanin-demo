import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/types/request-user';
import { BusinessReputationService } from './business-reputation.service';
import { ReputationBatchDto } from './dto/reputation-batch.dto';

@Controller('api/reputation')
@UseGuards(JwtAuthGuard)
export class BusinessReputationController {
  constructor(private readonly reputation: BusinessReputationService) {}

  // Вызывающий приходил сюда и раньше — и отбрасывался как `_user`.
  // Единственное, что отделяло оценку контрагента от оценки чужого
  // юридического лица, это подчёркивание в имени параметра.
  @Get('orgs/:orgId')
  getScore(@Param('orgId') orgId: string, @CurrentUser() user: RequestUser) {
    return this.reputation.getScore(orgId, user);
  }

  @Post('orgs/batch')
  getScoreBatch(@Body() body: ReputationBatchDto, @CurrentUser() user: RequestUser) {
    return this.reputation.getScoreBatch(body.orgIds ?? [], user);
  }
}
