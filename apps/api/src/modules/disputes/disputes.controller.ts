import { UseGuards, ForbiddenException } from '@nestjs/common';
import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { DisputesService } from './disputes.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { DecideDisputeDto } from './dto/decide-dispute.dto';
import { RequestUser, Role } from '../../common/types/request-user';

@UseGuards(RolesGuard)
@Roles(
  'SUPPORT_MANAGER', 'BUYER', 'FARMER', 'LAB', 'SURVEYOR', 'ACCOUNTING',
  'EXECUTIVE', 'COMPLIANCE_OFFICER', 'ARBITRATOR', 'ADMIN',
)
@Controller('disputes')
export class DisputesController {
  constructor(private readonly disputes: DisputesService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.disputes.list(user);
  }

  @Get(':id')
  getOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.disputes.getOne(id, user);
  }

  @Post()
  create(@Body() dto: CreateDisputeDto, @CurrentUser() user: RequestUser) {
    if (user.role === Role.EXECUTIVE) {
      throw new ForbiddenException('Executive role cannot create disputes');
    }
    return this.disputes.create(dto, user);
  }

  @Patch(':id/triage')
  triage(
    @Param('id') id: string,
    @Body() body: { idempotencyKey?: string },
    @CurrentUser() user: RequestUser,
  ) {
    return this.disputes.triage(id, user, body.idempotencyKey);
  }

  @Post(':id/evidence')
  addEvidence(
    @Param('id') id: string,
    @Body() body: {
      type: string;
      fileId?: string;
      url?: string;
      description?: string;
      source: string;
      idempotencyKey?: string;
    },
    @CurrentUser() user: RequestUser,
  ) {
    if (user.role === Role.EXECUTIVE) {
      throw new ForbiddenException('Executive role cannot add evidence');
    }
    return this.disputes.addEvidence(
      id,
      {
        type: body.type,
        fileId: body.fileId,
        url: body.url,
        description: body.description,
        source: body.source,
        trusted: false,
        idempotencyKey: body.idempotencyKey,
      },
      user,
    );
  }

  @Patch(':id/decision')
  decision(
    @Param('id') id: string,
    @Body() dto: DecideDisputeDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.disputes.decision(id, dto, user);
  }

  @Post(':id/appeals')
  openAppeal(
    @Param('id') id: string,
    @Body() body: {
      outcome: string;
      splitBuyerPct?: number;
      reason: string;
      idempotencyKey?: string;
    },
    @CurrentUser() user: RequestUser,
  ) {
    return this.disputes.openAppeal(id, body, user);
  }

  @Patch(':id/appeals/decision')
  resolveAppeal(
    @Param('id') id: string,
    @Body() body: {
      granted: boolean;
      outcome?: string;
      splitBuyerPct?: number;
      note: string;
      idempotencyKey?: string;
    },
    @CurrentUser() user: RequestUser,
  ) {
    return this.disputes.resolveAppeal(id, body, user);
  }
}
