import { UseGuards } from '@nestjs/common';
import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { LabsService } from './labs.service';
import { CreateSampleDto } from './dto/create-sample.dto';
import { RecordTestDto } from './dto/record-test.dto';

@UseGuards(RolesGuard)
@Roles('LAB', 'SUPPORT_MANAGER', 'BUYER', 'FARMER')
@Controller('labs')
export class LabsController {
  constructor(private readonly labs: LabsService) {}

  @Get('samples')
  list(@CurrentUser() user: any) {
    return this.labs.list(user);
  }

  @Get('samples/:id')
  getOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.labs.getOne(id, user);
  }

  @Post('samples')
  create(@Body() dto: CreateSampleDto, @CurrentUser() user: any) {
    return this.labs.create(dto, user);
  }

  @Patch('samples/:id/collect')
  collect(@Param('id') id: string, @CurrentUser() user: any) {
    return this.labs.collect(id, user);
  }

  @Post('samples/:id/tests')
  recordTest(@Param('id') id: string, @Body() dto: RecordTestDto, @CurrentUser() user: any) {
    return this.labs.recordTest(id, dto, user);
  }

  @Patch('samples/:id/finalize')
  finalize(@Param('id') id: string, @CurrentUser() user: any) {
    return this.labs.finalize(id, user);
  }
}
