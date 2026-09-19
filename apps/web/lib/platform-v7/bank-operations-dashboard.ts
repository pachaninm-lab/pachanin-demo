import {
  platformV7BankReleaseDecisionModel,
  type PlatformV7BankReleaseDecisionInput,
  type PlatformV7BankReleaseDecisionModel,
  type PlatformV7BankReleaseDecisionStatus,
  type PlatformV7BankReleaseDecisionTone,
} from './bank-release-decision';

export interface PlatformV7BankOperationsDealInput extends PlatformV7BankReleaseDecisionInput {
  title: string;
  owner: string;
}

export interface PlatformV7BankOperationsDealRow {
  dealId: string;
  title: string;
  owner: string;
  status: PlatformV7BankReleaseDecisionStatus;
  tone: PlatformV7BankReleaseDecisionTone;
  canRelease: boolean;
  releaseAmount: number;
  blockerCount: number;
  nextAction: string;
  decision: PlatformV7BankReleaseDecisionModel;
}

export interface PlatformV7BankOperationsSummary {
  totalDeals: number;
  releaseAllowed: number;
  manualReview: number;
  hold: number;
  blocked: number;
  totalBlockers: number;
  criticalReviews: number;
  amountReadyToRelease: number;
  amountUnderControl: number;
}

export interface PlatformV7BankOperationsDashboardModel {
  summary: PlatformV7BankOperationsSummary;
  queue: PlatformV7BankOperationsDealRow[];
  nextAction: string;
  isClean: boolean;
}

export function platformV7BankOperationsDashboardModel(
  deals: PlatformV7BankOperationsDealInput[],
): PlatformV7BankOperationsDashboardModel {
  const queue = deals
    .map((deal): PlatformV7BankOperationsDealRow => {
      const decision = platformV7BankReleaseDecisionModel(deal);

      return {
        dealId: deal.dealId,
        title: deal.title,
        owner: deal.owner,
        status: decision.status,
        tone: decision.tone,
        canRelease: decision.canRelease,
        releaseAmount: deal.releaseAmount,
        blockerCount: decision.blockerCount,
        nextAction: decision.nextAction,
        decision,
      };
    })
    .sort(platformV7BankOperationsSort);

  const summary = platformV7BankOperationsSummary(queue);

  return {
    summary,
    queue,
    nextAction: platformV7BankOperationsNextAction(summary, queue),
    isClean: platformV7BankOperationsIsClean(summary),
  };
}

export function platformV7BankOperationsSummary(
  queue: PlatformV7BankOperationsDealRow[],
): PlatformV7BankOperationsSummary {
  return {
    totalDeals: queue.length,
    releaseAllowed: queue.filter((row) => row.status === 'release_allowed').length,
    manualReview: queue.filter((row) => row.status === 'manual_review').length,
    hold: queue.filter((row) => row.status === 'hold').length,
    blocked: queue.filter((row) => row.status === 'blocked').length,
    totalBlockers: queue.reduce((sum, row) => sum + row.blockerCount, 0),
    criticalReviews: queue.filter((row) => row.decision.manualReview.priority === 'critical').length,
    amountReadyToRelease: queue
      .filter((row) => row.canRelease)
      .reduce((sum, row) => sum + Math.max(0, row.releaseAmount), 0),
    amountUnderControl: queue
      .filter((row) => !row.canRelease)
      .reduce((sum, row) => sum + Math.max(0, row.releaseAmount), 0),
  };
}

export function platformV7BankOperationsIsClean(summary: PlatformV7BankOperationsSummary): boolean {
  return summary.totalDeals > 0
    && summary.blocked === 0
    && summary.manualReview === 0
    && summary.hold === 0
    && summary.totalBlockers === 0;
}

export function platformV7BankOperationsNextAction(
  summary: PlatformV7BankOperationsSummary,
  queue: PlatformV7BankOperationsDealRow[],
): string {
  if (summary.totalDeals === 0) return 'Нет сделок для банковой очереди.';
  if (summary.blocked > 0) return queue.find((row) => row.status === 'blocked')?.nextAction ?? 'Снять критический банковый блокер.';
  if (summary.criticalReviews > 0) return 'Разобрать критические ручные проверки банка.';
  if (summary.manualReview > 0) return 'Разобрать очередь ручных банковых проверок.';
  if (summary.hold > 0) return queue.find((row) => row.status === 'hold')?.nextAction ?? 'Закрыть удержания перед выпуском денег.';
  return 'Банковая очередь чистая.';
}

export function platformV7BankOperationsSort(
  a: PlatformV7BankOperationsDealRow,
  b: PlatformV7BankOperationsDealRow,
): number {
  const rank = (status: PlatformV7BankReleaseDecisionStatus): number => {
    if (status === 'blocked') return 0;
    if (status === 'manual_review') return 1;
    if (status === 'hold') return 2;
    return 3;
  };

  return rank(a.status) - rank(b.status)
    || b.blockerCount - a.blockerCount
    || b.releaseAmount - a.releaseAmount
    || a.dealId.localeCompare(b.dealId);
}
