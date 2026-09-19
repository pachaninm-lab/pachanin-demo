import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { EvidencePackService, type EvidenceType } from './evidence-pack.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role, RequestUser } from '../../common/types/request-user';
import { IsString, IsOptional, IsEnum } from 'class-validator';

class UploadEvidenceBodyDto {
  @IsString() dealId!: string;
  @IsOptional() @IsString() shipmentId?: string;
  @IsOptional() @IsString() disputeId?: string;
  @IsEnum(['photo', 'gps_track', 'weight_ticket', 'lab_protocol', 'signature', 'document']) type!: EvidenceType;
  @IsString() filename!: string;
  @IsString() mimeType!: string;
  @IsString() content!: string;
  @IsOptional() metadata?: Record<string, unknown>;
}

@Controller('evidence-pack')
@UseGuards(RolesGuard)
export class EvidencePackController {
  constructor(private readonly svc: EvidencePackService) {}

  @Post('upload')
  @Roles(Role.DRIVER, Role.LAB, Role.SUPPORT_MANAGER, Role.ADMIN, Role.LOGISTICIAN, Role.ELEVATOR)
  upload(@Body() dto: UploadEvidenceBodyDto, @CurrentUser() user: RequestUser) {
    return this.svc.upload({ ...dto, content: dto.content }, user.id);
  }

  @Get('deal/:dealId')
  @Roles(Role.DRIVER, Role.LAB, Role.SUPPORT_MANAGER, Role.ADMIN, Role.LOGISTICIAN, Role.BUYER, Role.FARMER, Role.ELEVATOR)
  listByDeal(@Param('dealId') dealId: string) {
    return this.svc.listByDeal(dealId);
  }

  @Get('dispute/:disputeId')
  @Roles(Role.SUPPORT_MANAGER, Role.ADMIN)
  listByDispute(@Param('disputeId') disputeId: string) {
    return this.svc.listByDispute(disputeId);
  }

  @Get('deal/:dealId/verify-chain')
  @Roles(Role.ADMIN, Role.SUPPORT_MANAGER)
  verifyChain(@Param('dealId') dealId: string) {
    return this.svc.verifyDealChain(dealId);
  }
}
