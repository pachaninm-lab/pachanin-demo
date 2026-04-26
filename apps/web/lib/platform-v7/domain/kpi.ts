import type { CanonicalDeal, MoneyAmount } from './types';
import { calculateDealMoneyAtRisk, calculateMoneyKpi } from './money';

export interface ControlTowerKpi {
  readonly activeDeals: number;
  readonly disputedDeals: number;
  readonly blockedDeals: number;
  readonly totalGmv: MoneyAmount;
  readonly totalReserved: MoneyAmount;
  readonly moneyAtRisk: MoneyAmount;
  readonly readyToRelease: MoneyAmount;
  readonly averageRiskScore: number;
  readonly maxRiskScore: number;
}

export interface InvestorKpi {
  readonly gmv: MoneyAmount;
  readonly activeDeals: number;
  readonly closedDeals: number;
  readonly disputeRate: number;
  readonly moneyUnderControl: MoneyAmount;
  readonly blockedMoney: MoneyAmount;
}

export function calculateControlTowerKpi(deals: readonly CanonicalDeal[]): ControlTowerKpi {
  const money = calculateMoneyKpi(deals);
  const activeDeals = deals.filter((deal) => !['CLOSED', 'CANCELED'].includes(deal.status)).length;
  const disputedDeals = deals.filter((deal) => deal.status === 'DISPUTED').length;
  const blockedDeals = deals.filter((deal) => deal.blockers.length > 0).length;
  const readyToRelease = deals
    .filter((deal) => deal.status === 'RELEASE_PENDING' && deal.blockers.length === 0)
    .reduce((sum, deal) => sum + deal.money.releaseAmount, 0);
  const riskScores = deals.map((deal) => deal.riskScore);
  const riskSum = riskScores.reduce((sum, score) => sum + score, 0);

  return {
    activeDeals,
    disputedDeals,
    blockedDeals,
    totalGmv: money.totalGmv,
    totalReserved: money.totalReserved,
    moneyAtRisk: money.moneyAtRisk,
    readyToRelease,
    averageRiskScore: riskScores.length ? Math.round(riskSum / riskScores.length) : 0,
    maxRiskScore: riskScores.length ? Math.max(...riskScores) : 0,
  };
}

export function calculateInvestorKpi(deals: readonly CanonicalDeal[]): InvestorKpi {
  const activeDeals = deals.filter((deal) => !['CLOSED', 'CANCELED'].includes(deal.status)).length;
  const closedDeals = deals.filter((deal) => deal.status === 'CLOSED').length;
  const disputedDeals = deals.filter((deal) => deal.status === 'DISPUTED').length;
  const gmv = deals.reduce((sum, deal) => sum + deal.money.totalAmount, 0);
  const moneyUnderControl = deals.reduce((sum, deal) => sum + deal.money.reservedAmount, 0);
  const blockedMoney = deals.reduce((sum, deal) => sum + calculateDealMoneyAtRisk(deal), 0);

  return {
    gmv,
    activeDeals,
    closedDeals,
    disputeRate: deals.length ? Number((disputedDeals / deals.length).toFixed(4)) : 0,
    moneyUnderControl,
    blockedMoney,
  };
}
