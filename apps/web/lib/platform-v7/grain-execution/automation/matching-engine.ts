import type { GrainBatch, MoneyAmount, RFQ, RfqMatchResult } from '../types';
import { money } from '../format';
import { createNextAction } from './next-action-engine';

function includesNormalized(left: string | undefined, right: string | undefined): boolean {
  if (!left || !right) return false;
  return left.toLocaleLowerCase('ru-RU').includes(right.toLocaleLowerCase('ru-RU')) || right.toLocaleLowerCase('ru-RU').includes(left.toLocaleLowerCase('ru-RU'));
}

function estimateLogisticsCost(batch: GrainBatch, rfq: RFQ): number {
  if (batch.region === rfq.deliveryRegion) return 550;
  if (batch.region.includes('Тамбов') && rfq.deliveryRegion.includes('Москов')) return 820;
  return 1250;
}

function baseRisk(batch: GrainBatch): RfqMatchResult['riskLevel'] {
  if (batch.fgisStatus === 'sync_error' || batch.fgisStatus === 'blocked') return 'high';
  if (!batch.qualityProfileId || batch.fgisStatus === 'manual_mode') return 'medium';
  return 'low';
}

export function calculateDeliveredPricePerTon(batch: GrainBatch, rfq: RFQ): MoneyAmount {
  const target = rfq.maxPricePerTon?.value ?? rfq.targetPricePerTon?.value ?? 15000;
  const logistics = rfq.basis === 'CPT' || rfq.requiresLogistics ? estimateLogisticsCost(batch, rfq) : 0;
  const readinessDiscount = batch.readinessScore < 70 ? 350 : batch.readinessScore < 85 ? 120 : 0;
  return money(target + logistics - readinessDiscount);
}

export function matchBatchesToRfq(rfq: RFQ, batches: readonly GrainBatch[]): RfqMatchResult[] {
  return batches
    .map((batch) => {
      let score = 0;
      const reasons: string[] = [];

      if (includesNormalized(batch.crop, rfq.crop)) {
        score += 25;
        reasons.push('Культура совпадает.');
      }
      if (!rfq.gostClass || includesNormalized(batch.gostClass, rfq.gostClass)) {
        score += 15;
        reasons.push('Класс подходит под запрос.');
      }
      if (batch.availableVolumeTons >= (rfq.minVolumeTons ?? Math.min(rfq.volumeTons, 100))) {
        score += 20;
        reasons.push('Доступный объём закрывает минимальную поставку.');
      }
      if (batch.region === rfq.deliveryRegion) {
        score += 15;
        reasons.push('Регион совпадает с точкой поставки.');
      } else if (batch.region.includes('Тамбов') && rfq.deliveryRegion.includes('Москов')) {
        score += 10;
        reasons.push('Логистика до точки реалистична для пилотного сценария.');
      }
      if (batch.qualityProfileId) {
        score += 10;
        reasons.push('Есть профиль качества.');
      }
      if (['linked', 'manual_mode'].includes(batch.fgisStatus)) {
        score += 10;
        reasons.push('ФГИС/СДИЗ имеет понятный тестовый или ручной статус.');
      }
      if (batch.readinessScore >= 80) {
        score += 5;
        reasons.push('Партия почти готова к продаже.');
      }

      return {
        batch,
        score,
        riskLevel: baseRisk(batch),
        deliveredPricePerTon: calculateDeliveredPricePerTon(batch, rfq),
        reasons,
        nextAction: createNextAction({
          seed: `${rfq.id}-${batch.id}`,
          title: score >= 70 ? 'Запросить оффер' : 'Уточнить готовность партии',
          description: score >= 70 ? 'Партия подходит для запроса цены и документов.' : 'Перед сделкой нужно закрыть качество, ФГИС или документы.',
          role: 'buyer',
          priority: score >= 70 ? 'high' : 'medium',
          actionType: score >= 70 ? 'create_deal' : 'request_support',
          targetRoute: `/platform-v7/buyer/rfq/${rfq.id}`,
        }),
      } satisfies RfqMatchResult;
    })
    .filter((result) => result.score >= 35)
    .sort((a, b) => b.score - a.score);
}
