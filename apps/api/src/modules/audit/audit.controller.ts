import { Controller, Get, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/types/request-user';
import { AuditService } from './audit.service';

@Controller('audit')
@UseGuards(RolesGuard)
export class AuditController {
  constructor(private readonly svc: AuditService) {}

  @Get()
  @Roles(Role.ADMIN, Role.SUPPORT_MANAGER)
  list() {
    return this.svc.list();
  }
}
