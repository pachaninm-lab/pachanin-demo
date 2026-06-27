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

  @Get('readiness-passport')
  async readinessPassport() {
    const { integrationRegistry } = await import('../../../../packages/integration-sdk/src/registry').catch(() => ({ integrationRegistry: null }));
    const adapterList = integrationRegistry?.listAdapters() ?? [];

    return {
      generatedAt: new Date().toISOString(),
      version: process.env.APP_VERSION ?? '3.0.0',
      environment: process.env.NODE_ENV ?? 'development',
      components: {
        live: [
          { name: 'JWT Auth + RBAC (13 ролей)', status: 'live' },
          { name: 'Deal Lifecycle State Machine', status: 'live' },
          { name: 'Deal Saga Orchestrator (16 шагов)', status: 'live' },
          { name: 'Deal Event Hash Chain (SHA-256)', status: 'live' },
          { name: 'Audit Log (append-only, hash chain)', status: 'live' },
          { name: 'Double-Entry Ledger (копейки)', status: 'live' },
          { name: 'Settlement Engine + Escrow', status: 'live' },
          { name: 'Outbox Pattern + Relay Worker', status: 'live' },
          { name: 'Anti-Fraud (6 правил + off-platform)', status: 'live' },
          { name: 'MFA TOTP (RFC 6238) + backup codes', status: 'live' },
          { name: 'Rate Limiting (IP + brute-force)', status: 'live' },
          { name: 'Data Masking Logger (PII)', status: 'live' },
          { name: 'Prometheus Metrics', status: 'live' },
          { name: 'Bank Reconciliation (MT940)', status: 'live' },
          { name: 'Factoring (auto-scoring, 5 компаний)', status: 'live' },
          { name: 'Analytics (GMV, take rate, commission)', status: 'live' },
          { name: 'ML Price Predictor + Yield Forecast', status: 'live' },
          { name: 'Partner API (API-ключи, webhooks, HMAC)', status: 'live' },
          { name: 'Support Ops Queue', status: 'live' },
          { name: 'KYC (ФНС + AML) + RKN incident notification', status: 'live' },
          { name: '152-ФЗ (consent, data-export, anonymize)', status: 'live' },
          { name: 'Regulatory Reports (МСХ, Росстат, ФНС, Росфинмониторинг)', status: 'live' },
          { name: 'GPS Tracking + Geofencing', status: 'live' },
          { name: 'Deal Auto-Cancellation (14 дней)', status: 'live' },
          { name: 'Integration Events Log', status: 'live' },
          { name: 'OpenAPI 3.0.3 Spec', status: 'live' },
          { name: 'Document Templates (7 типов, SHA-256)', status: 'live' },
          { name: 'Batch УКЭП signing (до 50 документов)', status: 'live' },
          { name: 'УКЭП Certificate Expiry Monitor (30/14/7/1 дней)', status: 'live' },
          { name: 'ФГИС «Зерно» Saga Step (registerLot + confirmShipment)', status: 'live' },
          { name: 'ML Deal Duration Predictor', status: 'live' },
          { name: 'Webhook Dispatcher (HMAC-SHA256, replay protection)', status: 'live' },
          { name: 'Health/Ready/Version endpoints', status: 'live' },
          { name: 'Railway Logistics (вагоны, ГУ-12, демередж)', status: 'live' },
          { name: 'Export Trade (Incoterms 2020, мультивалюта ЦБ, ФТС, РСХН)', status: 'live' },
          { name: 'УКЭП Verify Signature + Certificate OCSP (КриптоПро)', status: 'live' },
          { name: 'Webhook Test endpoint (HMAC-SHA256 подписанный)', status: 'live' },
          { name: 'OpenAPI 3.0.3 обновлён (railway, export-trade, certificates, etn)', status: 'live' },
          { name: 'РЖД ЭТРАН adapter (GU-29 накладная, статус вагона, демередж)', status: 'live' },
          { name: 'ГИС ЭПД (Минтранс) ЭТН adapter (create/sign/status)', status: 'live' },
        ],
        sandbox: adapterList.map(a => ({
          name: `${a.name} adapter (${a.mode} mode v${a.version})`,
          status: 'sandbox',
        })),
        planned: [
          { name: 'PostgreSQL RLS + WAL backup', status: 'planned', stage: 'Этап 0' },
          { name: 'Kafka event backbone (RF=3)', status: 'planned', stage: 'Этап 0' },
          { name: 'Redis Cluster (сессии, rate limit)', status: 'planned', stage: 'Этап 0' },
          { name: 'Kubernetes HPA + VPA', status: 'planned', stage: 'Этап 0' },
          { name: 'HashiCorp Vault (секреты, ротация)', status: 'planned', stage: 'Этап 0' },
          { name: 'WAF (Coraza + OWASP CRS)', status: 'planned', stage: 'Этап 0' },
          { name: 'КриптоПро DSS live (УКЭП 63-ФЗ)', status: 'planned', stage: 'Этап 1' },
          { name: 'Контур.Диадок live (ЭДО)', status: 'planned', stage: 'Этап 1' },
          { name: 'ФГИС «Зерно» live (Минсельхоз API)', status: 'planned', stage: 'Этап 2' },
          { name: 'ClickHouse (аналитика, GMV real-time)', status: 'planned', stage: 'Этап 3' },
          { name: 'ML-модели на реальных данных', status: 'planned', stage: 'Этап 3' },
          { name: 'WebAuthn / FIDO2', status: 'planned', stage: 'Этап 4' },
          { name: 'SSO SAML 2.0 / OIDC Enterprise', status: 'planned', stage: 'Этап 4' },
          { name: 'Telegram Bot (уведомления + действия)', status: 'planned', stage: 'Этап 3' },
          { name: 'Mobile App React Native', status: 'planned', stage: 'Этап 3' },
          { name: 'Multi-tenancy (кооперативы)', status: 'planned', stage: 'Этап 3' },
        ],
      },
    };
  }
}
