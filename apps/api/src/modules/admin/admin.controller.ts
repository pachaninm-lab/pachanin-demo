import { Body, Controller, Get, NotFoundException, Param, Patch, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/types/request-user';
import { AuthService } from '../auth/auth.service';

@Controller('admin')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly auth: AuthService) {}

  @Get('users')
  listUsers() {
    return this.auth.listUsers();
  }

  @Patch('users/:id/role')
  updateRole(@Param('id') id: string, @Body() body: { role: Role }) {
    try {
      return this.auth.updateUserRole(id, body.role);
    } catch {
      throw new NotFoundException(`User ${id} not found`);
    }
  }

  @Patch('users/:id/org')
  updateOrg(@Param('id') id: string, @Body() body: { orgId: string }) {
    try {
      return this.auth.updateUserOrg(id, body.orgId);
    } catch {
      throw new NotFoundException(`User ${id} not found`);
    }
  }

  @Get('system')
  systemStatus() {
    return {
      uptime: process.uptime(),
      memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      nodeVersion: process.version,
      env: process.env.NODE_ENV ?? 'development',
      timestamp: new Date().toISOString(),
    };
  }
}
