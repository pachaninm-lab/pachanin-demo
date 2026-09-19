/**
 * ML Service HTTP client — вызывает FastAPI ML сервис из NestJS API.
 * При недоступности ML сервиса все методы gracefully degradируют.
 */

import { Injectable, Logger } from '@nestjs/common';

const ML_BASE = process.env.ML_SERVICE_URL || 'http://ml-service:8001';
const TIMEOUT_MS = 5000;

export interface PricePrediction {
  price_per_ton_kopecks: number;
  total_kopecks: number;
  confidence_interval: { low: number; high: number };
  factors: Record<string, unknown>;
  model: string;
}

export interface FraudCheckResult {
  risk_score: number;
  is_suspicious: boolean;
  flags: string[];
  action: 'ALLOW' | 'REVIEW' | 'BLOCK';
  reason: string | null;
}

export interface ScoringResult {
  organization_id: string;
  score: number;
  grade: string;
  risk_level: string;
  factors: Record<string, unknown>;
  recommendation: string;
}

@Injectable()
export class MlClientService {
  private readonly logger = new Logger(MlClientService.name);

  async predictPrice(params: {
    region: string;
    cropType: string;
    cropClass?: string;
    volumeTons: number;
    deliveryDate?: string;
  }): Promise<PricePrediction | null> {
    return this.post<PricePrediction>('/api/ml/price/predict', {
      region: params.region,
      crop_type: params.cropType,
      crop_class: params.cropClass ?? '4',
      volume_tons: params.volumeTons,
      delivery_date: params.deliveryDate,
    });
  }

  async checkFraud(params: {
    userId: string;
    organizationId: string;
    action: string;
    amountKopecks?: number;
    actionsLastHour?: number;
    newCounterparty?: boolean;
    offHours?: boolean;
    amountDeviationPct?: number;
    documentMismatch?: boolean;
    roleAbuseSignal?: boolean;
    vpnDetected?: boolean;
    previouslyFlagged?: boolean;
  }): Promise<FraudCheckResult | null> {
    return this.post<FraudCheckResult>('/api/ml/fraud/check', {
      user_id: params.userId,
      organization_id: params.organizationId,
      action: params.action,
      amount_kopecks: params.amountKopecks,
      actions_last_hour: params.actionsLastHour ?? 0,
      new_counterparty: params.newCounterparty ?? false,
      off_hours: params.offHours ?? false,
      amount_deviation_pct: params.amountDeviationPct ?? 0,
      document_mismatch: params.documentMismatch ?? false,
      role_abuse_signal: params.roleAbuseSignal ?? false,
      vpn_detected: params.vpnDetected ?? false,
      previously_flagged: params.previouslyFlagged ?? false,
    });
  }

  async scoreCounterparty(params: {
    organizationId: string;
    inn?: string;
    totalDeals?: number;
    cancelledDeals?: number;
    disputeDeals?: number;
    avgDealVolumeTons?: number;
    totalGmvKopecks?: number;
    avgDaysToClose?: number;
    platformAgeDays?: number;
    kycStatus?: string;
    amlStatus?: string;
    sanctionHit?: boolean;
    latePayments?: number;
    factoringOverdue?: boolean;
  }): Promise<ScoringResult | null> {
    return this.post<ScoringResult>('/api/ml/scoring/score', {
      organization_id: params.organizationId,
      inn: params.inn,
      total_deals: params.totalDeals ?? 0,
      cancelled_deals: params.cancelledDeals ?? 0,
      dispute_deals: params.disputeDeals ?? 0,
      avg_deal_volume_tons: params.avgDealVolumeTons ?? 0,
      total_gmv_kopecks: params.totalGmvKopecks ?? 0,
      avg_days_to_close: params.avgDaysToClose ?? 0,
      platform_age_days: params.platformAgeDays ?? 0,
      kyc_status: params.kycStatus ?? 'APPROVED',
      aml_status: params.amlStatus ?? 'CLEAR',
      sanction_hit: params.sanctionHit ?? false,
      late_payments: params.latePayments ?? 0,
      factoring_overdue: params.factoringOverdue ?? false,
    });
  }

  private async post<T>(path: string, body: unknown): Promise<T | null> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const resp = await fetch(`${ML_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!resp.ok) {
        this.logger.warn(`ML service ${path} returned ${resp.status}`);
        return null;
      }

      return resp.json() as Promise<T>;
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        this.logger.warn(`ML service ${path} timed out after ${TIMEOUT_MS}ms`);
      } else {
        this.logger.warn(`ML service ${path} unreachable: ${err}`);
      }
      return null;
    }
  }
}
