import {
  Body,
  Controller,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import type { RequestUser } from '../../common/types/request-user';
import { RegistrationApplicationCancellationService } from './registration-application-cancellation.service';
import { StaffAccessGuard } from './staff-access.guard';
import { StaffAccessModes } from './staff-access-modes.decorator';
import { StaffAccessService } from './staff-access.service';
import { StaffPermissions } from './staff-permissions.decorator';
import { StaffAccessMode, StaffPermission } from './staff-access.types';

class CancelRegistrationApplicationDto {
  @IsString()
  @MinLength(8)
  @MaxLength(1000)
  reason!: string;
}

type StaffRequest = {
  user: RequestUser;
};

@Controller('staff/registration/applications')
export class RegistrationApplicationCancellationController {
  constructor(
    private readonly access: StaffAccessService,
    private readonly cancellation: RegistrationApplicationCancellationService,
  ) {}

  @Post(':applicationId/cancel')
  @UseGuards(StaffAccessGuard)
  @StaffAccessModes(StaffAccessMode.CONTROL_PLANE)
  @StaffPermissions(StaffPermission.STAFF_REQUEST_APPROVE)
  @RateLimit({
    name: 'staff_registration_application_cancel',
    scope: 'user',
    limit: 20,
    windowSeconds: 900,
    includeParams: ['applicationId'],
  })
  async cancelRegistrationApplication(
    @Req() request: StaffRequest,
    @Param('applicationId') applicationId: string,
    @Body() body: CancelRegistrationApplicationDto,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    await this.access.requirePermission(request.user, StaffPermission.STAFF_REQUEST_APPROVE);
    return this.cancellation.cancel(
      applicationId,
      body.reason,
      request.user,
      String(idempotencyKey || ''),
      String(correlationId || ''),
    );
  }
}
