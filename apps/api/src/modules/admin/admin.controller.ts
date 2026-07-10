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
      commit: process.env.GIT_COMMIT ?? 'local',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('outbox')
  async outboxStatus() {
    const [entries, stats] = await Promise.all([this.outbox.list(), this.outbox.stats()]);
    return {
      total: entries.length,
      ...stats,
      sent: entries.filter((entry) => entry.status === 'SENT').length,
      confirmed: entries.filter((entry) => entry.status === 'CONFIRMED').length,
      recentEntries: entries.slice(0, 50),
      deliverySemantics: 'at-least-once',
    };
  }

  @Post('outbox/:id/requeue')
  requeueOutbox(
    @Param('id') id: string,
    @Body() body: { reason?: string; actorUserId?: string },
  ) {
    return this.outbox.requeue(id, body.actorUserId || 'admin', body.reason || 'manual_review_completed');
  }

  @Patch('users/:id/block')
  blockUser(@Param('id') id: string, @Body() body: { blocked: boolean }) {
    const users = this.auth.listUsers();
    const user = users.find((item) => item.id === id);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return {
      id,
      blocked: body.blocked,
      message: 'Persistent account blocking requires the dedicated auth command boundary.',
      applied: false,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('users/:id/force-logout')
  async forceLogout(@Param('id') id: string) {
    await this.auth.revokeUserSessions(id, 'ADMIN_FORCE_LOGOUT');
    return { id, revoked: true, timestamp: new Date().toISOString() };
  }

  @Get('users/:id/mfa-status')
  mfaStatus(@Param('id') id: string) {
    const users = this.auth.listUsers();
    const user = users.find((item) => item.id === id);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return {
      userId: id,
      status: 'available_through_persistent_auth_audit',
      note: 'MFA secret material and backup-code hashes are never returned by admin APIs.',
    };
  }

  @Get('health')
  async healthDetailed() {
    const stats = await this.outbox.stats();
    const { integrationRegistry } = await import('../../../../packages/integration-sdk/src/registry')
      .catch(() => ({ integrationRegistry: null }));
    const integrations = integrationRegistry
      ? await integrationRegistry.healthCheckAll().catch(() => ({}))
      : {};
    return {
      status: stats.dead > 10 ? 'degraded' : 'ok',
      outbox: stats,
      integrations,
      maturity: 'isolated-postgresql-e2e-proven',
      productionAcceptance: false,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('readiness-passport')
  async readinessPassport() {
    const { integrationRegistry } = await import('../../../../packages/integration-sdk/src/registry')
      .catch(() => ({ integrationRegistry: null }));
    const adapters = integrationRegistry?.listAdapters() ?? [];
    const stats = await this.outbox.stats();

    return {
      generatedAt: new Date().toISOString(),
      version: process.env.APP_VERSION ?? '3.0.0',
      environment: process.env.NODE_ENV ?? 'development',
      maturity: {
        architecture: 'industrial_target',
        isolatedPostgresqlEvidence: true,
        productionDeploymentConfirmed: false,
        liveExternalIntegrationsConfirmed: false,
        productionScaleConfirmed: false,
      },
      provenInIsolatedPostgresql: [
        'persistent identity, session rotation, revocation and MFA',
        'server-derived RBAC and tenant authority',
        '12-role / 19-command canonical Deal execution',
        'separate restricted auth and deal database principals',
        'backup and isolated restore rehearsal',
        'distributed rate limiting',
      ],
      inProgress: [
        {
          name: 'durable financial delivery',
          pullRequest: '#2307',
          outbox: stats,
        },
      ],
      adapters: adapters.map((adapter) => ({
        name: adapter.name,
        mode: adapter.mode,
        version: adapter.version,
        liveConfirmed: adapter.mode === 'live' ? false : null,
      })),
      remainingNoGo: [
        'live bank, ФГИС, ЭДО and ЕСИА credentials/contracts',
        'production migration execution evidence',
        'provider PITR with measured RTO and approved RPO',
        'production load, HA and operational acceptance',
      ],
    };
  }

  @Post('simulate-deal')
  simulateDealE2E() {
    return {
      status: 'disabled',
      acceptedAsEvidence: false,
      reason: 'Synthetic fake-live deal simulation is not an operational acceptance path. Use the isolated PostgreSQL 12-role/19-command exploitation gate.',
      evidenceCommand: 'bash scripts/platform-v7-one-deal-e2e.sh',
    };
  }
}
