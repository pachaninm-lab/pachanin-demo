import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequestUser } from '../../common/types/request-user';
import { OrganizationsService, CreateOrgDto } from './organizations.service';

/**
 * Реестр организаций и решение о допуске на платформу.
 * Аутентификацию выполняет глобальный auth-guard (роль приходит из серверной
 * сессии); прежний локальный JwtAuthGuard читал несуществующий клейм role из
 * access-токена, и ролевые проверки были невозможны для боевых токенов.
 */
@Controller('api/organizations')
@UseGuards(RolesGuard)
export class OrganizationsController {
  constructor(private readonly orgs: OrganizationsService) {}

  @Get('fns-lookup')
  @Roles('ANY_AUTHENTICATED')
  lookupByInn(@Query('inn') inn: string) {
    return this.orgs.lookupByInn(inn);
  }

  @Post()
  @Roles('ANY_AUTHENTICATED')
  register(@Body() dto: CreateOrgDto, @CurrentUser() user: RequestUser) {
    return this.orgs.register(dto, user);
  }

  @Get()
  @Roles('SUPPORT_MANAGER', 'ADMIN', 'COMPLIANCE_OFFICER', 'EXECUTIVE')
  list(
    @CurrentUser() user: RequestUser,
    @Query('status') status?: string,
    @Query('kycStatus') kycStatus?: string,
  ) {
    return this.orgs.list(user, { status, kycStatus });
  }

  @Get(':id')
  @Roles('ANY_AUTHENTICATED')
  getOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.orgs.getOne(id, user);
  }

  @Patch(':id/status')
  @Roles('SUPPORT_MANAGER', 'ADMIN', 'COMPLIANCE_OFFICER')
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string; reason: string },
    @CurrentUser() user: RequestUser,
  ) {
    return this.orgs.updateStatus(id, body?.status ?? '', body?.reason ?? '', user);
  }
}
