import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GektaAccessService } from './gekta-access.service';
import { GektaOperatorService } from './gekta-operator.service';
import { GektaPhoneService } from './gekta-phone.service';
import { GektaWorkspaceService } from './gekta-workspace.service';
import { GektaOperatorGuard, RequireGektaPermission, permissionsFor, resolveGektaRoles } from './gekta-operator.guard';
import { GektaSessionGuard, type GektaSessionRequest } from './gekta-session.guard';
import { AllowProductSession } from '../../common/decorators/product-session.decorator';

type AuthedRequest = { user?: { id?: string; sub?: string; gektaRoles?: string[]; staffRoles?: string[] } };

function userIdOf(request: AuthedRequest): string {
  const id = request.user?.id ?? request.user?.sub;
  if (!id) throw new Error('unauthenticated');
  return id;
}

/**
 * Идентификатор пользователя кабинета берётся из актора, который уже разобрал
 * GektaSessionGuard. Ни платформенная, ни продуктовая сессия не читаются здесь
 * напрямую: иначе появился бы второй способ решить, кто вызывает.
 */
function accountUserIdOf(request: GektaSessionRequest): string {
  const id = request.gektaActor?.userId;
  if (!id) throw new Error('unauthenticated');
  return id;
}

function rolesOf(request: AuthedRequest): string[] {
  return resolveGektaRoles(request.user);
}

/**
 * Пользовательская часть кабинета Гекты.
 *
 * Каждый маршрут работает только с аккаунтом вызывающего: идентификатор
 * аккаунта берётся из сессии, а не из тела запроса, поэтому чужой accountId
 * подставить нельзя.
 */
@Controller('gekta')
@AllowProductSession()
@UseGuards(GektaSessionGuard)
export class GektaController {
  constructor(
    private readonly access: GektaAccessService,
    private readonly workspace: GektaWorkspaceService,
    private readonly phone: GektaPhoneService,
  ) {}

  @Get('entitlement')
  async entitlement(@Req() request: GektaSessionRequest) {
    const userId = accountUserIdOf(request);
    await this.access.ensureAccount(userId);
    return { entitlement: await this.access.resolveEntitlement(userId) };
  }

  private async accountIdFor(request: GektaSessionRequest): Promise<string> {
    const account = await this.access.ensureAccount(accountUserIdOf(request));
    return account.id;
  }

  @Get('phone')
  async phoneState(@Req() request: GektaSessionRequest) {
    return this.phone.currentIdentity(await this.accountIdFor(request));
  }

  @Post('phone')
  async declarePhone(@Req() request: GektaSessionRequest, @Body() body: { phone?: string }) {
    const accountId = await this.accountIdFor(request);
    const identity = await this.phone.declarePhone(accountId, String(body?.phone ?? ''));
    // Состояние возвращается как есть: DECLARED никогда не показывается как подтверждённое.
    return { state: identity.state, declaredAt: identity.declaredAt };
  }

  @Get('projects')
  async listProjects(@Req() request: GektaSessionRequest) {
    return { projects: await this.workspace.listProjects(await this.accountIdFor(request)) };
  }

  @Post('projects')
  async createProject(@Req() request: GektaSessionRequest, @Body() body: { name?: string; description?: string; locale?: string }) {
    const accountId = await this.accountIdFor(request);
    return this.workspace.createProject(accountId, String(body?.name ?? ''), String(body?.description ?? ''), String(body?.locale ?? 'ru'));
  }

  @Patch('projects/:id')
  async renameProject(@Req() request: GektaSessionRequest, @Param('id') id: string, @Body() body: { name?: string; description?: string }) {
    const accountId = await this.accountIdFor(request);
    return this.workspace.renameProject(accountId, id, String(body?.name ?? ''), body?.description);
  }

  @Delete('projects/:id')
  async deleteProject(@Req() request: GektaSessionRequest, @Param('id') id: string) {
    return this.workspace.deleteProject(await this.accountIdFor(request), id);
  }

  @Get('conversations')
  async listConversations(@Req() request: GektaSessionRequest, @Query('projectId') projectId?: string, @Query('search') search?: string) {
    const accountId = await this.accountIdFor(request);
    return {
      conversations: await this.workspace.listConversations(accountId, {
        ...(projectId === undefined ? {} : { projectId: projectId || null }),
        ...(search ? { search } : {}),
      }),
    };
  }

  @Get('conversations/:id')
  async getConversation(@Req() request: GektaSessionRequest, @Param('id') id: string) {
    return this.workspace.getConversation(await this.accountIdFor(request), id);
  }

  @Post('conversations')
  async createConversation(@Req() request: GektaSessionRequest, @Body() body: { title?: string; locale?: string; projectId?: string | null }) {
    const accountId = await this.accountIdFor(request);
    return this.workspace.createConversation(accountId, String(body?.title ?? ''), String(body?.locale ?? 'ru'), body?.projectId ?? null);
  }

  @Post('conversations/:id/messages')
  async appendMessage(@Req() request: GektaSessionRequest, @Param('id') id: string, @Body() body: { role?: string; body?: string; citations?: unknown; attachments?: unknown }) {
    const accountId = await this.accountIdFor(request);
    const role = body?.role === 'assistant' ? 'assistant' : 'user';
    const message = await this.workspace.appendMessage(accountId, id, {
      role,
      body: String(body?.body ?? ''),
      citations: body?.citations,
      attachments: body?.attachments,
    });
    // Счётчик двигает только завершённый ответ ассистента.
    if (role === 'assistant') await this.access.recordCompletedAnswer(accountId);
    return message;
  }

  @Patch('conversations/:id')
  async updateConversation(@Req() request: GektaSessionRequest, @Param('id') id: string, @Body() body: { title?: string; projectId?: string | null }) {
    const accountId = await this.accountIdFor(request);
    if (body?.projectId !== undefined) return this.workspace.moveConversation(accountId, id, body.projectId);
    return this.workspace.renameConversation(accountId, id, String(body?.title ?? ''));
  }

  @Delete('conversations/:id')
  async deleteConversation(@Req() request: GektaSessionRequest, @Param('id') id: string) {
    return this.workspace.deleteConversation(await this.accountIdFor(request), id);
  }

  @Delete('conversations')
  async clearHistory(@Req() request: GektaSessionRequest) {
    return this.workspace.clearHistory(await this.accountIdFor(request));
  }

  @Post('history/import')
  async importHistory(@Req() request: GektaSessionRequest, @Body() body: { conversations?: unknown }) {
    const accountId = await this.accountIdFor(request);
    const incoming = Array.isArray(body?.conversations) ? body.conversations : [];
    return this.workspace.importAnonymousHistory(accountId, incoming as never);
  }
}

/**
 * Кабинет оператора и владельца.
 *
 * Права проверяются на сервере отдельным guard. Ни один маршрут здесь не
 * отдаёт содержание диалогов: для этого нужен отдельный грант пользователя.
 */
@Controller('gekta/operator')
@UseGuards(JwtAuthGuard, GektaOperatorGuard)
export class GektaOperatorController {
  constructor(
    private readonly operator: GektaOperatorService,
    private readonly access: GektaAccessService,
    private readonly phone: GektaPhoneService,
  ) {}

  /**
   * Собственные права вызывающего. Нужны интерфейсу, чтобы не показывать
   * кнопку, которая всё равно вернёт отказ. Разрешения здесь только
   * сообщаются — решение по каждому маршруту всё равно принимает guard.
   */
  @Get('permissions')
  permissions(@Req() request: AuthedRequest) {
    const roles = rolesOf(request);
    return { roles, permissions: [...permissionsFor(roles)] };
  }

  @Get('metrics')
  @RequireGektaPermission('metrics.read_global')
  async metrics() {
    return this.operator.metrics();
  }

  /**
   * Поиск по телефону может вернуть несколько аккаунтов с неподтверждённым
   * номером. Угадывать нельзя: ответ помечается ambiguous, и владелец выбирает
   * конкретный accountId.
   */
  @Get('search')
  @RequireGektaPermission('account.search')
  async search(@Query('phone') phoneQuery?: string, @Query('email') email?: string, @Query('accountId') accountId?: string) {
    if (accountId) {
      const summary = await this.operator.accountSummary(accountId);
      return { status: summary ? 'single' : 'not_found', accounts: summary ? [summary] : [] };
    }
    if (email) {
      const matches = await this.operator.findAccountByEmail(email);
      return { status: matches.length === 1 ? 'single' : matches.length ? 'ambiguous' : 'not_found', accounts: matches };
    }
    if (phoneQuery) {
      const matches = await this.phone.findAccountsByPhone(phoneQuery);
      return {
        status: matches.length === 1 ? 'single' : matches.length ? 'ambiguous' : 'not_found',
        accounts: matches.map((match) => ({ accountId: match.accountId, phoneState: match.state })),
      };
    }
    return { status: 'not_found', accounts: [] };
  }

  @Get('accounts/:id')
  @RequireGektaPermission('account.read_metadata')
  async account(@Param('id') id: string) {
    return this.operator.accountSummary(id);
  }

  @Get('accounts/:id/audit')
  @RequireGektaPermission('audit.read')
  async audit(@Param('id') id: string) {
    return { entries: await this.operator.auditTrail(id) };
  }

  @Post('accounts/:id/grant')
  @RequireGektaPermission('entitlement.grant_manual')
  async grant(
    @Req() request: AuthedRequest,
    @Param('id') accountId: string,
    @Body() body: { kind?: string; until?: string; reason?: string },
  ) {
    const kind = body?.kind === 'DAYS_30' ? 'DAYS_30' : body?.kind === 'UNTIL_DATE' ? 'UNTIL_DATE' : 'DAYS_7';
    const before = await this.access.resolveEntitlementByAccount(accountId);
    const grant = await this.access.grantManualAccess({
      accountId,
      kind,
      until: body?.until ? new Date(body.until) : null,
      grantedBy: userIdOf(request),
      reason: String(body?.reason ?? ''),
    });
    const after = await this.access.resolveEntitlementByAccount(accountId);
    await this.operator.writeAudit({
      correlationId: grant.id,
      actorUserId: userIdOf(request),
      actorRoles: rolesOf(request),
      accountId,
      phoneLocatorMasked: null,
      action: 'entitlement.grant_manual',
      previousState: before.state,
      newState: after.state,
      reason: String(body?.reason ?? ''),
      expiresAt: grant.expiresAt,
      source: 'operator_console',
    });
    return { grant, entitlement: after };
  }

  @Post('accounts/:id/grant-lifetime')
  @RequireGektaPermission('entitlement.grant_lifetime')
  async grantLifetime(@Req() request: AuthedRequest, @Param('id') accountId: string, @Body() body: { reason?: string }) {
    const before = await this.access.resolveEntitlementByAccount(accountId);
    const grant = await this.access.grantManualAccess({
      accountId,
      kind: 'LIFETIME',
      grantedBy: userIdOf(request),
      reason: String(body?.reason ?? ''),
    });
    const after = await this.access.resolveEntitlementByAccount(accountId);
    await this.operator.writeAudit({
      correlationId: grant.id,
      actorUserId: userIdOf(request),
      actorRoles: rolesOf(request),
      accountId,
      phoneLocatorMasked: null,
      action: 'entitlement.grant_lifetime',
      previousState: before.state,
      newState: after.state,
      reason: String(body?.reason ?? ''),
      expiresAt: null,
      source: 'operator_console',
    });
    return { grant, entitlement: after };
  }

  @Post('grants/:grantId/revoke')
  @RequireGektaPermission('entitlement.revoke_manual')
  async revoke(@Req() request: AuthedRequest, @Param('grantId') grantId: string, @Body() body: { reason?: string }) {
    const grant = await this.access.revokeGrant(grantId, userIdOf(request));
    const after = await this.access.resolveEntitlementByAccount(grant.accountId);
    await this.operator.writeAudit({
      correlationId: grant.id,
      actorUserId: userIdOf(request),
      actorRoles: rolesOf(request),
      accountId: grant.accountId,
      phoneLocatorMasked: null,
      action: 'entitlement.revoke',
      previousState: grant.kind,
      newState: after.state,
      reason: String(body?.reason ?? ''),
      expiresAt: null,
      source: 'operator_console',
    });
    return { grant, entitlement: after };
  }

  @Post('accounts/:id/extend-trial')
  @RequireGektaPermission('entitlement.extend_trial')
  async extendTrial(@Req() request: AuthedRequest, @Param('id') accountId: string, @Body() body: { days?: number; reason?: string }) {
    const before = await this.access.resolveEntitlementByAccount(accountId);
    const days = Number.isFinite(body?.days) && (body?.days ?? 0) > 0 ? Math.min(Number(body?.days), 365) : 30;
    const account = await this.access.extendTrial(accountId, days);
    const after = await this.access.resolveEntitlementByAccount(accountId);
    await this.operator.writeAudit({
      correlationId: `trial-${account.id}-${Date.now()}`,
      actorUserId: userIdOf(request),
      actorRoles: rolesOf(request),
      accountId,
      phoneLocatorMasked: null,
      action: 'entitlement.extend_trial',
      previousState: before.state,
      newState: after.state,
      reason: String(body?.reason ?? ''),
      expiresAt: account.trialEndsAt,
      source: 'operator_console',
    });
    return { entitlement: after };
  }

  @Post('accounts/:id/suspend')
  @RequireGektaPermission('account.suspend')
  async suspend(@Req() request: AuthedRequest, @Param('id') accountId: string, @Body() body: { suspended?: boolean; reason?: string }) {
    const before = await this.access.resolveEntitlementByAccount(accountId);
    await this.access.setSuspended(accountId, body?.suspended !== false, String(body?.reason ?? ''));
    const after = await this.access.resolveEntitlementByAccount(accountId);
    await this.operator.writeAudit({
      correlationId: `suspend-${accountId}-${Date.now()}`,
      actorUserId: userIdOf(request),
      actorRoles: rolesOf(request),
      accountId,
      phoneLocatorMasked: null,
      action: 'account.suspend',
      previousState: before.state,
      newState: after.state,
      reason: String(body?.reason ?? ''),
      expiresAt: null,
      source: 'operator_console',
    });
    return { entitlement: after };
  }

  @Post('accounts/:id/reset-quota')
  @RequireGektaPermission('entitlement.reset_quota')
  async resetQuota(@Req() request: AuthedRequest, @Param('id') accountId: string, @Body() body: { reason?: string }) {
    await this.access.resetDailyQuota(accountId);
    await this.operator.writeAudit({
      correlationId: `quota-${accountId}-${Date.now()}`,
      actorUserId: userIdOf(request),
      actorRoles: rolesOf(request),
      accountId,
      phoneLocatorMasked: null,
      action: 'entitlement.reset_quota',
      previousState: 'quota_exhausted',
      newState: 'quota_reset',
      reason: String(body?.reason ?? ''),
      expiresAt: null,
      source: 'operator_console',
    });
    return { ok: true };
  }
}
