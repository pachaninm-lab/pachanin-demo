import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/types/request-user';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrganizationCapabilityService } from './organization-capability.service';
import type { OrganizationCapabilityMutationBody } from './organization-capability.types';

@Controller('api/organization-capabilities')
@UseGuards(JwtAuthGuard)
export class OrganizationCapabilityController {
  constructor(private readonly capabilities: OrganizationCapabilityService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.capabilities.list(user);
  }

  @Put(':capabilityCode')
  mutate(
    @Param('capabilityCode') capabilityCode: string,
    @Body() body: OrganizationCapabilityMutationBody,
    @CurrentUser() user: RequestUser,
  ) {
    return this.capabilities.mutate(capabilityCode, body ?? {}, user);
  }
}
