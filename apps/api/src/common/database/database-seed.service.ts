import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RuntimeCoreService } from '../../modules/runtime-core/runtime-core.service';

@Injectable()
export class DatabaseSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseSeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly runtime: RuntimeCoreService,
  ) {}

  async onApplicationBootstrap() {
    try {
      await this.seedDeals();
      await this.seedShipments();
      await this.seedDocuments();
      await this.seedLabSamples();
    } catch (err) {
      this.logger.warn(`DB seed skipped: ${(err as Error).message}`);
    }
  }

  private async seedDeals() {
    const existing = await this.prisma.deal.count();
    if (existing > 0) return;
    const deals = this.runtime.listDeals({ id: 'seed', role: 'ADMIN', orgId: 'system', email: 'seed@system' });
    for (const deal of deals) {
      await this.prisma.deal.upsert({
        where: { id: deal.id },
        update: {},
        create: {
          id: deal.id,
          lotId: deal.lotId,
          status: deal.status,
          sellerOrgId: deal.sellerOrgId ?? 'unknown',
          buyerOrgId: deal.buyerOrgId ?? 'unknown',
          volumeTons: deal.volumeTons,
          pricePerTon: deal.pricePerTon,
          totalRub: deal.totalRub,
          currency: deal.currency ?? 'RUB',
          culture: deal.culture,
          region: deal.region,
          fundingChoice: deal.fundingChoice,
          owner: deal.owner,
          nextAction: deal.nextAction,
          signedAt: deal.signedAt ? new Date(deal.signedAt) : null,
          meta: deal.paymentTerms ? JSON.stringify(deal.paymentTerms) : null,
        },
      });
    }
    this.logger.log(`Seeded ${deals.length} deals`);
  }

  private async seedShipments() {
    const existing = await this.prisma.shipment.count();
    if (existing > 0) return;
    const shipments = this.runtime.listShipments();
    for (const ship of shipments) {
      await this.prisma.shipment.upsert({
        where: { id: ship.id },
        update: {},
        create: {
          id: ship.id,
          dealId: ship.dealId,
          status: ship.status,
          driverUserId: ship.driverUserId,
          driverName: ship.driverName,
          vehicleNumber: ship.vehicleNumber,
          carrierOrgId: ship.carrierOrgId,
          carrierName: ship.carrierName,
          routeFrom: ship.routeFrom,
          routeTo: ship.routeTo,
          etaHours: ship.etaHours,
          loadedTons: ship.loadedTons,
          pinVerified: ship.pinVerified ?? false,
          nextAction: ship.nextAction,
          blockers: ship.blockers ? JSON.stringify(ship.blockers) : null,
        },
      });
    }
    this.logger.log(`Seeded ${shipments.length} shipments`);
  }

  private async seedDocuments() {
    const existing = await this.prisma.dealDocument.count();
    if (existing > 0) return;
    const docs = this.runtime.listDocuments();
    for (const doc of docs) {
      await this.prisma.dealDocument.upsert({
        where: { id: doc.id },
        update: {},
        create: {
          id: doc.id,
          dealId: doc.dealId,
          type: doc.type,
          status: doc.status,
          name: doc.name ?? `${doc.type}-${doc.id}`,
          mimeType: doc.mimeType,
          uploadedByUserId: doc.uploadedByUserId,
          signedAt: doc.signedAt ? new Date(doc.signedAt) : null,
          bankRequired: doc.bankRequired ?? false,
          releaseRequired: doc.releaseRequired ?? false,
          bankAcceptance: doc.bankAcceptance ?? 'PENDING',
          version: doc.version ?? 1,
        },
      });
    }
    this.logger.log(`Seeded ${docs.length} documents`);
  }

  private async seedLabSamples() {
    const existing = await this.prisma.labSample.count();
    if (existing > 0) return;
    const samples = this.runtime.listSamples();
    for (const sample of samples) {
      await this.prisma.labSample.upsert({
        where: { id: sample.id },
        update: {},
        create: {
          id: sample.id,
          dealId: sample.dealId,
          shipmentId: sample.shipmentId,
          status: sample.status,
          culture: sample.culture,
          protocol: sample.protocol,
          labId: sample.labId,
          collectedAt: sample.collectedAt ? new Date(sample.collectedAt) : null,
          finalizedAt: sample.finalizedAt ? new Date(sample.finalizedAt) : null,
          moneyDeltaRub: sample.moneyDeltaRub,
          tests: {
            create: (sample.tests ?? []).map((t: any) => ({
              id: t.id,
              parameter: t.parameter,
              value: t.value,
              unit: t.unit,
              norm: t.norm,
              passed: t.passed,
              recordedAt: new Date(t.recordedAt),
            })),
          },
        },
      });
    }
    this.logger.log(`Seeded ${samples.length} lab samples`);
  }
}
