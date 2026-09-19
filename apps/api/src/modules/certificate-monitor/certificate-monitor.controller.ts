import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CertificateMonitorService, RegisterCertificateDto } from './certificate-monitor.service';

@UseGuards(RolesGuard)
@Roles('FARMER', 'BUYER', 'SUPPORT_MANAGER', 'ACCOUNTING', 'LAB', 'LOGISTICIAN', 'EXECUTIVE', 'ADMIN', 'COMPLIANCE_OFFICER', 'ARBITRATOR')
@Controller('certificates')
export class CertificateMonitorController {
  constructor(private readonly monitor: CertificateMonitorService) {}

  @Get('my')
  listMy(@CurrentUser() user: any) {
    return this.monitor.listForUser(user.id);
  }

  @Get('org/:orgId')
  @Roles('ADMIN', 'SUPPORT_MANAGER', 'COMPLIANCE_OFFICER', 'EXECUTIVE')
  listForOrg(@Param('orgId') orgId: string) {
    return this.monitor.listForOrg(orgId);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.monitor.getById(id) ?? { error: 'Certificate not found' };
  }

  @Post('register')
  register(@Body() body: Omit<RegisterCertificateDto, 'userId'>, @CurrentUser() user: any) {
    return this.monitor.register({ ...body, userId: user.id });
  }

  @Delete(':id/revoke')
  revoke(@Param('id') id: string, @CurrentUser() user: any) {
    return this.monitor.revoke(id, user.id);
  }

  @Post(':id/revoke-admin')
  @Roles('ADMIN', 'COMPLIANCE_OFFICER')
  revokeAdmin(@Param('id') id: string) {
    return this.monitor.revokeAdmin(id);
  }

  /** Manual trigger for expiry check (admin) */
  @Post('check-now')
  @Roles('ADMIN')
  checkNow() {
    return this.monitor.checkExpirations();
  }
}
