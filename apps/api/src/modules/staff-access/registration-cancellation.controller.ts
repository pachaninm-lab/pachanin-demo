import {
  Body,
  Controller,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import type { RequestUser } from '../../common/types/request-user';
import { RegistrationCancellationService } from '../auth/registration-cancellation.service';
import { RegistrationCancellationDto } from '../auth/dto/registration-application.dto';
import { StaffAccessGuard } from './staff-access.guard';
import { StaffAccessModes } from './staff-access-modes.decorator';
import { StaffAccessService } from './staff-access.service';
import { StaffPermissions } from './staff-permissions.decorator';
import { StaffAccessMode, StaffPermission } from './staff-access.types';

type StaffRequest = { user: RequestUser };

@Controller('staff/registration/applications')
export class RegistrationCancellationController {
  constructor(
    private readonly access: StaffAccessService,
    private readonly cancellations: RegistrationCancellationService,
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
  async cancel(
    @Req() request: StaffRequest,
    @Param('applicationId') applicationId: string,
    @Body() body: RegistrationCancellationDto,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    await this.access.requirePermission(request.user, StaffPermission.STAFF_REQUEST_APPROVE);
    return this.cancellations.cancel(
      applicationId,
      body.reason,
      request.user,
      String(idempotencyKey || ''),
      String(correlationId || ''),
    );
  }
}
