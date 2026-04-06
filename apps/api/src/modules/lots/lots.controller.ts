import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UseGuards } from '@nestjs/common';
import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { LotsService } from './lots.service';
import { CreateLotDto } from './dto/create-lot.dto';

@UseGuards(RolesGuard)
@Roles('FARMER', 'BUYER', 'SUPPORT_MANAGER')
@Controller('lots')
export class LotsController {
  constructor(private readonly lots: LotsService) {}

  @Public()
  @Get()
  list(@CurrentUser() user?: any) {
    return this.lots.list(user);
  }

  @Public({ envFlag: 'ENABLE_PUBLIC_LOT_REPORTS' })
  @Get('report')
  report(@CurrentUser() user?: any) {
    return this.lots.listReport(user);
  }

  @Public({ envFlag: 'ENABLE_PUBLIC_LOT_REPORTS' })
  @Get(':id/report')
  reportOne(@Param('id') id: string, @CurrentUser() user?: any) {
    return this.lots.getReport(id, user);
  }

  @Get('my')
  my(@CurrentUser() user: any) {
    return this.lots.list(user);
  }

  @Post()
  create(@Body() dto: CreateLotDto, @CurrentUser() user: any) {
    return this.lots.create(dto, user);
  }

  @Patch(':id/submit')
  submit(@Param('id') id: string, @CurrentUser() user: any) {
    return this.lots.submit(id, user);
  }

  @Patch(':id/publish')
  publish(@Param('id') id: string, @CurrentUser() user: any) {
    return this.lots.publish(id, user);
  }
}
