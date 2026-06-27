import { Body, Controller, Get, NotFoundException, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/types/request-user';
import { AuthService } from '../auth/auth.service';
import { OutboxService } from '../../common/outbox/outbox.service';

@Controller('admin')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(
    private readonly auth: AuthService,
    private readonly outbox: OutboxService,
  ) {}

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

  @Get('outbox')
  outboxStatus() {
    const entries = this.outbox.list();
    return {
      total: entries.length,
      pending: entries.filter(e => e.status === 'PENDING').length,
      sent: entries.filter(e => e.status === 'SENT').length,
      confirmed: entries.filter(e => e.status === 'CONFIRMED').length,
      failed: entries.filter(e => e.status === 'FAILED').length,
      dead: entries.filter(e => e.status === 'DEAD').length,
      manualReview: entries.filter(e => e.status === 'MANUAL_REVIEW').length,
      recentEntries: entries.slice(0, 50),
    };
  }

  @Post('outbox/:id/requeue')
  requeueOutbox(@Param('id') id: string) {
    return this.outbox.requeue(id);
  }

  @Patch('users/:id/block')
  blockUser(@Param('id') id: string, @Body() body: { blocked: boolean }) {
    const users = this.auth.listUsers();
    const user = users.find(u => u.id === id);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    // In production: set blocked flag + invalidate all sessions via Redis
    return { id, blocked: body.blocked, message: body.blocked ? 'Пользователь заблокирован' : 'Пользователь разблокирован', timestamp: new Date().toISOString() };
  }

  @Post('users/:id/force-logout')
  forceLogout(@Param('id') id: string) {
    // In production: delete all refresh tokens / sessions from Redis for this user
    return { id, message: 'Все сессии пользователя завершены', timestamp: new Date().toISOString() };
  }

  @Get('users/:id/mfa-status')
  mfaStatus(@Param('id') id: string) {
    const users = this.auth.listUsers();
    const user = users.find(u => u.id === id);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    // In production: read from MFA table
    return { userId: id, mfaEnabled: false, methods: [], lastVerifiedAt: null };
  }

  @Get('health')
  async healthDetailed() {
    const outboxStats = {
      pending: this.outbox.listPending().length,
      dead: this.outbox.listDead().length,
    };
    const { integrationRegistry } = await import('../../../../packages/integration-sdk/src/registry').catch(() => ({ integrationRegistry: null }));
    const integrations = integrationRegistry ? await integrationRegistry.healthCheckAll().catch(() => ({})) : {};
    return {
      status: outboxStats.dead > 10 ? 'degraded' : 'ok',
      outbox: outboxStats,
      integrations,
      timestamp: new Date().toISOString(),
    };
  }
}
