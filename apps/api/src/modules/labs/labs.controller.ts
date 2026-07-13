import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { RequestUser } from '../../common/types/request-user';
import { CollectSampleDto } from './dto/collect-sample.dto';
import { CreateSampleDto } from './dto/create-sample.dto';
import { FinalizeSampleDto } from './dto/finalize-sample.dto';
import { RecordTestDto } from './dto/record-test.dto';
import { LabsService } from './labs.service';

@UseGuards(RolesGuard)
@Roles('LAB', 'SUPPORT_MANAGER', 'BUYER', 'FARMER')
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

  @Post('samples')
  create(@Body() dto: CreateSampleDto, @CurrentUser() user: RequestUser) {
    return this.labs.create(dto, user);
  }

  @Patch('samples/:id/collect')
  collect(
    @Param('id') id: string,
    @Body() dto: CollectSampleDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.labs.collect(id, dto, user);
  }

  @Post('samples/:id/tests')
  recordTest(
    @Param('id') id: string,
    @Body() dto: RecordTestDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.labs.recordTest(id, dto, user);
  }

  @Patch('samples/:id/finalize')
  finalize(
    @Param('id') id: string,
    @Body() dto: FinalizeSampleDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.labs.finalize(id, dto, user);
  }
}
