import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Optional,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser, Role } from '../../common/types/request-user';
import { IntegrationEventsService } from './integration-events.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { toSafeIntegrationEventView } from './integration-event-redaction.policy';

const ALLOWED_ROLES: Role[] = [
  Role.ADMIN,
  Role.SUPPORT_MANAGER,
  Role.COMPLIANCE_OFFICER,
  Role.EXECUTIVE,
];

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
    if (!ALLOWED_ROLES.includes(user.role as Role)) {
      throw new ForbiddenException('Доступ запрещён');
    }

    if (!this.prisma) {
      return { items: [], total: 0, note: 'Database not available' };
    }

    const fromInstant = optionalInstant(from, 'from');
    const toInstant = optionalInstant(to, 'to');
    if (fromInstant && toInstant && fromInstant.getTime() > toInstant.getTime()) {
      throw new BadRequestException('from must be before or equal to to');
    }

    const entries = await this.prisma.integrationEvent.findMany({
      where: {
        ...(adapter && { adapterName: adapter }),
        ...(direction && { direction }),
        ...(status && { status }),
        ...(dealId && { dealId }),
        ...(fromInstant || toInstant
          ? {
              createdAt: {
                ...(fromInstant && { gte: fromInstant }),
                ...(toInstant && { lte: toInstant }),
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: boundedTake(take),
    }).catch(() => []);

    const items = entries.map(toSafeIntegrationEventView);
    return { items, total: items.length };
  }

  @Get('stats')
  async stats(@CurrentUser() user: RequestUser) {
    if (!ALLOWED_ROLES.includes(user.role as Role)) {
      throw new ForbiddenException();
    }
    if (!this.prisma) return {};

    // Aggregate-only service result: no request/response/error body can escape.
    return this.events.getStats();
  }

  @Get(':id')
  async getOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    if (!ALLOWED_ROLES.includes(user.role as Role)) {
      throw new ForbiddenException();
    }
    if (!this.prisma) throw new ForbiddenException('Database not available');

    const event = await this.prisma.integrationEvent.findUnique({ where: { id } });
    if (!event) throw new ForbiddenException(`Event ${id} not found`);
    return toSafeIntegrationEventView(event);
  }
}

function boundedTake(value: string | undefined): number {
  if (value === undefined || value.trim() === '') return 100;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 500) {
    throw new BadRequestException('take must be an integer from 1 to 500');
  }
  return parsed;
}

function optionalInstant(value: string | undefined, field: string): Date | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw new BadRequestException(`${field} must be a valid timestamp`);
  }
  return parsed;
}
