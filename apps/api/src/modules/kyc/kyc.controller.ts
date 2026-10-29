import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/types/request-user';
import { KycService } from './kyc.service';
import {
  InitiateKycDto,
  RknIncidentDto,
  TransactionAmlCheckDto,
  VerifyInnDto,
  VerifyOrganizationDto,
} from './dto/kyc.dto';

@Controller('api/kyc')
@UseGuards(JwtAuthGuard)
export class KycController {
  constructor(private readonly kyc: KycService) {}

  @Post('verify')
  verify(
    @Body() body: VerifyOrganizationDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.kyc.verifyOrganization({ ...body, requestingUserId: user.id });
  }

  @Post('transaction/aml-check')
  checkTransactionAml(
    @Body() body: TransactionAmlCheckDto,
  ) {
    return this.kyc.checkTransactionAml(body);
  }

  @Post('initiate')
  initiate(
    @Body() body: InitiateKycDto,
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
    @Body() body: RknIncidentDto,
  ) {
    return this.kyc.generateRknIncidentNotification(body);
  }

  @Get('egrul/:inn')
  getEgrul(@Param('inn') inn: string) {
    return this.kyc.getEgrul(inn);
  }

  @Post('verify-inn')
  verifyInn(@Body() body: VerifyInnDto) {
    return this.kyc.verifyInn(body.inn, body.ogrn);
  }
}
