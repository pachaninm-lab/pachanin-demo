import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser, Role } from '../../common/types/request-user';
import { IntegrationEventsService } from './integration-events.service';
import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Optional } from '@nestjs/common';

const ALLOWED_ROLES: Role[] = [Role.ADMIN, Role.SUPPORT_MANAGER, Role.COMPLIANCE_OFFICER, Role.EXECUTIVE];

@Controller('api/integration-events')
@UseGuards(JwtAuthGuard)
export class IntegrationEventsController {
  constructor(
    private readonly events: IntegrationEventsService,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: RequestUser,
    @Query('adapter') adapter?: string,
    @Query('direction') direction?: string,
    @Query('status') status?: string,
    @Query('dealId') dealId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('take') take?: string,
  ) {
    if (!ALLOWED_ROLES.includes(user.role as Role)) throw new ForbiddenException('Доступ запрещён');

    if (!this.prisma) {
      return { items: [], total: 0, note: 'Database not available' };
    }

    const entries = await this.prisma.integrationEvent.findMany({
      where: {
        ...(adapter && { adapterName: adapter }),
        ...(direction && { direction }),
        ...(status && { status }),
        ...(dealId && { dealId }),
        ...(from || to ? { createdAt: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(take ?? 100), 500),
    }).catch(() => []);

    return { items: entries, total: entries.length };
  }

  @Get('stats')
  async stats(@CurrentUser() user: RequestUser) {
    if (!ALLOWED_ROLES.includes(user.role as Role)) throw new ForbiddenException();
    if (!this.prisma) return {};

    const [total, byAdapter, byStatus] = await Promise.all([
      this.prisma.integrationEvent.count().catch(() => 0),
      this.prisma.integrationEvent.groupBy({ by: ['adapterName'], _count: true }).catch(() => []),
      this.prisma.integrationEvent.groupBy({ by: ['status'], _count: true }).catch(() => []),
    ]);

    return {
      total,
      byAdapter: Object.fromEntries(byAdapter.map(r => [r.adapterName, r._count])),
      byStatus: Object.fromEntries(byStatus.map(r => [r.status, r._count])),
    };
  }

  @Get(':id')
  async getOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    if (!ALLOWED_ROLES.includes(user.role as Role)) throw new ForbiddenException();
    if (!this.prisma) throw new ForbiddenException('Database not available');

    const event = await this.prisma.integrationEvent.findUnique({ where: { id } });
    if (!event) throw new ForbiddenException(`Event ${id} not found`);
    return event;
  }
}
