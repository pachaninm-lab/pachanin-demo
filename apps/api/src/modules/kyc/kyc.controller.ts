import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/types/request-user';
import { KycService } from './kyc.service';

@Controller('api/kyc')
@UseGuards(JwtAuthGuard)
export class KycController {
  constructor(private readonly kyc: KycService) {}

  @Post('verify')
  verify(
    @Body() body: {
      inn: string;
      organizationName?: string;
      bik?: string;
      bankAccount?: string;
    },
    @CurrentUser() user: RequestUser,
  ) {
    return this.kyc.verifyOrganization({ ...body, requestingUserId: user.id });
  }

  @Post('transaction/aml-check')
  checkTransactionAml(
    @Body() body: {
      transactionId: string;
      amountKopecks: number;
      payerInn?: string;
      receiverInn?: string;
      dealId?: string;
    },
  ) {
    return this.kyc.checkTransactionAml(body);
  }

  @Post('initiate')
  initiate(
    @Body() body: {
      organizationId: string;
      inn: string;
      documentType?: string;
      notes?: string;
    },
    @CurrentUser() user: RequestUser,
  ) {
    return this.kyc.initiateKyc(body, user);
  }

  @Get('status/:organizationId')
  getStatus(@Param('organizationId') organizationId: string, @CurrentUser() user: RequestUser) {
    return this.kyc.getKycStatus(organizationId, user);
  }

  @Post('rkn-incident')
  generateRknNotification(
    @Body() body: {
      incidentType: string;
      description: string;
      affectedSubjectsCount: number;
      detectedAt: string;
      reporterFullName: string;
      reporterPosition: string;
    },
  ) {
    return this.kyc.generateRknIncidentNotification(body);
  }
}
