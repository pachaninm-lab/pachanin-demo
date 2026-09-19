import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/types/request-user';
import { OrganizationsService, CreateOrgDto } from './organizations.service';

@Controller('api/organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly orgs: OrganizationsService) {}

  @Get('fns-lookup')
  lookupByInn(@Query('inn') inn: string) {
    return this.orgs.lookupByInn(inn);
  }

  @Post()
  register(@Body() dto: CreateOrgDto, @CurrentUser() user: RequestUser) {
    return this.orgs.register(dto, user);
  }

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query('status') status?: string,
    @Query('kycStatus') kycStatus?: string,
  ) {
    return this.orgs.list(user, { status, kycStatus });
  }

  @Get(':id')
  getOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.orgs.getOne(id, user);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() body: { status: string }, @CurrentUser() user: RequestUser) {
    return this.orgs.updateStatus(id, body.status, user);
  }
}
