import { Controller, Get, Req } from '@nestjs/common';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RequestUser } from '../../common/types/request-user';
import { StaffCapabilitiesService } from './staff-capabilities.service';

type StaffRequest = {
  user: RequestUser;
};

@Controller('staff/capabilities')
export class StaffCapabilitiesController {
  constructor(private readonly capabilities: StaffCapabilitiesService) {}

  @Get('me')
  @RateLimit({ name: 'staff_capabilities_me', scope: 'user', limit: 120, windowSeconds: 60 })
  getMine(@Req() request: StaffRequest) {
    return this.capabilities.getMine(request.user);
  }
}
