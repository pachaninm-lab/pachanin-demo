import { Injectable } from '@nestjs/common';
import {
  buildProviderCategorySummary,
  buildProviderSelection,
  buildProviderStagePlan,
  evaluateProviderComplianceGate,
  listServiceProviders,
  type ProviderComplianceContext,
  type ProviderSelectionContext,
  type ServiceProviderCategory,
  type ServiceProviderStage,
} from '../../../../../packages/domain-core/src';
import type { RequestUser } from '../../common/types/request-user';
import type { ProviderRegistryCommand } from './provider-registry.contract';
import { ProviderRegistryRepository } from './provider-registry.repository';

@Injectable()
export class ServiceProvidersService {
  constructor(private readonly repository: ProviderRegistryRepository) {}

  async summary(user: RequestUser) {
    const catalog = await this.repository.catalog(user);
    return {
      generatedAt: new Date().toISOString(),
      categories: buildProviderCategorySummary(catalog),
      bankDefault: null,
      stages: ['DISPATCH', 'LAB', 'RECEIVING', 'EXPORT', 'PAYMENT'],
      authority: 'POSTGRESQL',
      verificationMode: 'SERVER_HELD',
    };
  }

  async catalog(user: RequestUser, category?: ServiceProviderCategory) {
    const catalog = await this.repository.catalog(user, category);
    return {
      generatedAt: new Date().toISOString(),
      category: category || null,
      items: listServiceProviders(catalog, category),
      authority: 'POSTGRESQL',
    };
  }

  async recommendation(
    user: RequestUser,
    category: ServiceProviderCategory,
    context: ProviderSelectionContext,
  ) {
    const catalog = await this.repository.catalog(user, category);
    return {
      generatedAt: new Date().toISOString(),
      ...buildProviderSelection(category, context, catalog),
      authority: 'POSTGRESQL',
    };
  }

  async plan(user: RequestUser, stage: ServiceProviderStage, context: ProviderSelectionContext) {
    const catalog = await this.repository.catalog(user);
    return {
      generatedAt: new Date().toISOString(),
      ...buildProviderStagePlan(stage, context, catalog),
      authority: 'POSTGRESQL',
    };
  }

  async compliance(
    user: RequestUser,
    providerId: string,
    context: ProviderComplianceContext,
  ) {
    const authority = await this.repository.complianceEvidence(user, providerId, context);
    return {
      generatedAt: new Date().toISOString(),
      providerId,
      decision: evaluateProviderComplianceGate({
        context: { ...context, legalRole: authority.legalRole as ProviderComplianceContext['legalRole'] },
        evidence: authority.evidence,
      }),
      evidenceAuthority: 'SERVER_REGISTRY',
    };
  }

  ownRegistry(user: RequestUser) {
    return this.repository.ownRegistry(user);
  }

  execute(user: RequestUser, command: ProviderRegistryCommand) {
    return this.repository.execute(user, command);
  }
}
