import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestUser, Role } from '../../common/types/request-user';
import { integrationRegistry } from '../../../../../packages/integration-sdk/src/registry';

export interface CreateOrgDto {
  inn: string;
  name?: string;
  ogrn?: string;
  type?: string;
  bankDetails?: string;
  address?: string;
}

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(@Optional() private readonly prisma?: PrismaService) {}

  async lookupByInn(inn: string): Promise<{ inn: string; name: string; ogrn?: string; address?: string; taxStatus?: string }> {
    try {
      const fns = integrationRegistry.get('fns') as any;
      const result = await fns.execute({ action: 'getOrganizationByInn', inn });
      return { inn: result.inn, name: result.name, ogrn: result.ogrn, address: result.address, taxStatus: result.taxStatus };
    } catch (err) {
      this.logger.debug(`FNS lookup failed for INN ${inn}: ${(err as Error).message}`);
      return { inn, name: `Организация с ИНН ${inn}` };
    }
  }

  async register(dto: CreateOrgDto, user: RequestUser): Promise<{ id: string; inn: string; name: string; kycTaskId?: string }> {
    const id = `org-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let name = dto.name ?? '';
    let address = dto.address;

    try {
      const fnsData = await this.lookupByInn(dto.inn);
      if (!name) name = fnsData.name;
      if (!address) address = fnsData.address;
    } catch {}

    if (this.prisma) {
      const existing = await this.prisma.organization.findUnique({ where: { inn: dto.inn } }).catch(() => null);
      if (existing) throw new ConflictException(`Организация с ИНН ${dto.inn} уже зарегистрирована`);

      await this.prisma.organization.create({
        data: {
          id,
          inn: dto.inn,
          ogrn: dto.ogrn,
          name,
          type: (dto.type ?? 'LEGAL') as any,
          status: 'PENDING' as any,
          tenantId: user.orgId ?? '',
          bankDetails: dto.bankDetails,
          address,
          kycStatus: 'PENDING' as any,
          amlStatus: 'CLEAR' as any,
        },
      });

      const kycTaskId = `kyc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await this.prisma.kycTask.create({
        data: {
          id: kycTaskId,
          organizationId: id,
          type: 'INITIAL' as any,
          status: 'PENDING' as any,
        },
      }).catch((e) => this.logger.debug(`KYC task create failed: ${e.message}`));

      return { id, inn: dto.inn, name, kycTaskId };
    }

    return { id, inn: dto.inn, name };
  }

  async getOne(id: string, user: RequestUser) {
    if (!this.prisma) throw new NotFoundException('Database not available');
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException(`Организация ${id} не найдена`);
    return org;
  }

  async list(user: RequestUser, filters?: { status?: string; kycStatus?: string }) {
    if (!this.prisma) return [];
    return this.prisma.organization.findMany({
      where: {
        ...(filters?.status && { status: filters.status as any }),
        ...(filters?.kycStatus && { kycStatus: filters.kycStatus as any }),
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    }).catch(() => []);
  }

  async updateStatus(id: string, status: string, user: RequestUser) {
    if (user.role !== Role.ADMIN && user.role !== Role.COMPLIANCE_OFFICER) {
      throw new ForbiddenException('Только администратор или офицер комплаенса может обновлять статус организации');
    }
    if (!this.prisma) throw new NotFoundException('Database not available');
    return this.prisma.organization.update({
      where: { id },
      data: { status: status as any },
    });
  }
}
