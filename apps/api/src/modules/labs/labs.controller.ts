import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { RequestUser } from '../../common/types/request-user';
import { LabsService } from './labs.service';
import { CreateSampleDto } from './dto/create-sample.dto';
import { CollectSampleDto } from './dto/collect-sample.dto';
import { RecordCustodyDto } from './dto/record-custody.dto';
import { RecordTestDto } from './dto/record-test.dto';

@UseGuards(RolesGuard)
@Roles('LAB', 'SUPPORT_MANAGER', 'ADMIN', 'BUYER', 'FARMER', 'SURVEYOR', 'ELEVATOR', 'COMPLIANCE_OFFICER')
@Controller('labs')
export class LabsController {
  constructor(private readonly labs: LabsService) {}

  @Get('samples')
  list(@CurrentUser() user: RequestUser) {
    return this.labs.list(user);
  }

  @Get('samples/:id')
  getOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.labs.getOne(id, user);
  }

  @Get('samples/:id/workspace')
  workspace(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.labs.workspace(id, user);
  }

  @Roles('LAB', 'SUPPORT_MANAGER', 'ADMIN')
  @Post('samples')
  create(@Body() dto: CreateSampleDto, @CurrentUser() user: RequestUser) {
    return this.labs.create(dto, user);
  }

  @Roles('LAB', 'SURVEYOR', 'SUPPORT_MANAGER', 'ADMIN')
  @Patch('samples/:id/collect')
  collect(
    @Param('id') id: string,
    @Body() dto: CollectSampleDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.labs.collect(id, dto, user);
  }

  @Roles('LAB', 'SURVEYOR', 'SUPPORT_MANAGER', 'ADMIN')
  @Post('samples/:id/custody')
  recordCustody(
    @Param('id') id: string,
    @Body() dto: RecordCustodyDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.labs.recordCustody(id, dto, user);
  }

  @Roles('LAB', 'SUPPORT_MANAGER', 'ADMIN')
  @Post('samples/:id/tests')
  recordTest(
    @Param('id') id: string,
    @Body() dto: RecordTestDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.labs.recordTest(id, dto, user);
  }

  @Roles('LAB', 'SUPPORT_MANAGER', 'ADMIN')
  @Patch('samples/:id/finalize')
  finalize(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.labs.finalize(id, user);
  }
}
