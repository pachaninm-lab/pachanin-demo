import type { GrainQualityProfile, SampleChain } from '../types';

export function evaluateSampleChain(chain: SampleChain, acceptedQuality?: GrainQualityProfile) {
  const blockers: string[] = [];

  if (!chain.takenAt) blockers.push('Не зафиксировано время отбора пробы.');
  if (!chain.takenByRole || !chain.takenByName) blockers.push('Не указан ответственный за пробу.');
  if (!chain.sealNumber) blockers.push('Не указан номер пломбы.');
  if (chain.photoIds.length === 0) blockers.push('Нет фото пробы или пломбы.');
  if (!chain.labProtocolId && acceptedQuality?.labProtocolId) blockers.push('Протокол лаборатории не связан с цепочкой пробы.');
  if (acceptedQuality && acceptedQuality.sampleChainId && acceptedQuality.sampleChainId !== chain.id) blockers.push('Результат лаборатории связан с другой пробой.');

  return {
    status: blockers.length > 0 ? ('manual_review' as const) : ('ready' as const),
    blockers,
    repeatAnalysisAvailable: chain.repeatAllowed,
    arbitrationSampleExists: chain.arbitrationSampleExists,
    evidencePackId: chain.evidencePackId,
  };
}

export function nextSampleStep(chain: SampleChain): string {
  switch (chain.status) {
    case 'not_started':
      return 'Отобрать пробу при приёмке.';
    case 'sample_taken':
      return 'Опломбировать пробу и добавить фото.';
    case 'sealed':
      return 'Передать пробу в лабораторию.';
    case 'sent_to_lab':
      return 'Подтвердить получение лабораторией.';
    case 'lab_received':
      return 'Дождаться протокола лаборатории.';
    case 'protocol_ready':
      return chain.repeatAllowed ? 'Принять результат или запросить повторный анализ.' : 'Принять результат или открыть спор.';
    case 'repeat_requested':
      return 'Дождаться повторного анализа.';
    case 'arbitration_requested':
      return 'Дождаться арбитражного результата.';
    case 'closed':
    default:
      return 'Цепочка пробы закрыта.';
  }
}
