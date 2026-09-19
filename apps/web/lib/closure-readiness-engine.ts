export function buildOperatorEscalationDeck(cockpit?: any, readiness?: any) {
  const queues = cockpit?.queues || {};
  const items = [
    ...(queues.moneyAtRisk || []),
    ...(queues.escalations || []),
    ...(queues.blockedByDocsLabReceiving || []),
  ];
  return items.slice(0, 12).map((item: any, index: number) => ({
    id: item.id || `escalation-${index + 1}`,
    title: item.title || item.reason || `Escalation ${index + 1}`,
    detail: item.reason || item.detail || 'Operator follow-up required',
    owner: item.owner || 'operator',
    nextAction: item.nextAction || 'Open linked rail',
    severity: item.severity || 'amber',
    href: item.href || '/control',
    readinessScore: readiness?.summary?.railScore ?? null,
  }));
}

export function buildOfflineConflictCases() {
  return [
    {
      id: 'offline-1',
      title: 'Signed evidence queue',
      detail: 'Браузерный mobile rail требует явного queued sync для полевых доказательств.',
    },
    {
      id: 'offline-2',
      title: 'GPS / media handoff',
      detail: 'Если background sync не гарантирован, нужен честный fallback с audit trail.',
    },
  ];
}

export function buildFieldOfflineLanes({ stage, liveMode, pendingActions, needsGpsEvidence, canQueueOffline, hasBrowserConstraint }: any) {
  return [
    {
      stage: `${stage || 'field'}-queue`,
      status: canQueueOffline ? 'QUEUE_READY' : 'QUEUE_GAP',
      reason: canQueueOffline ? 'Queue fallback available' : 'Queue fallback missing',
      owner: 'mobile',
      actions: ['queue sync', 'reconcile evidence'],
    },
    {
      stage: `${stage || 'field'}-gps`,
      status: needsGpsEvidence ? (liveMode ? 'GPS_LIVE' : 'GPS_PENDING') : 'GPS_OPTIONAL',
      reason: needsGpsEvidence ? 'GPS evidence required for execution truth' : 'GPS evidence optional',
      owner: 'mobile',
      actions: hasBrowserConstraint ? ['signed fallback'] : ['live capture'],
    },
    {
      stage: `${stage || 'field'}-pending`,
      status: pendingActions ? 'ACTION_BACKLOG' : 'CLEAR',
      reason: pendingActions ? `${pendingActions} pending field actions` : 'No pending field actions',
      owner: 'operator',
      actions: ['resolve backlog'],
    },
  ];
}

export function buildDocumentClosureState(document?: any) {
  if (!document) {
    return {
      status: 'pending',
      items: [],
    };
  }

  const missing = Array.isArray(document?.packageState?.missing) ? document.packageState.missing : [];
  const signed = String(document?.signStatus || '').toUpperCase() === 'SIGNED';
  const truth = String(document?.truthState || 'AMBER').toUpperCase();
  const providerMode = String(document?.providerMode || 'MANUAL').toUpperCase();

  const items = [
    {
      id: 'document-truth',
      title: 'Source of truth',
      status: truth,
      detail: truth === 'GREEN' ? 'Документ подтверждён как канонический.' : 'Нужно проверить источник и финальность документа.',
    },
    {
      id: 'document-signature',
      title: 'Signature status',
      status: signed ? 'SIGNED' : 'UNSIGNED',
      detail: signed ? 'Подпись уже есть, документ может закрывать обязательство.' : 'Без подписи документ не закрывает обязательство.',
    },
    {
      id: 'document-provider',
      title: 'Provider mode',
      status: providerMode,
      detail: providerMode === 'LIVE' ? 'Провайдер работает в live-контуре.' : 'Провайдер работает в sandbox/manual режиме.',
    },
    {
      id: 'document-package',
      title: 'Package completeness',
      status: missing.length ? 'MISSING' : 'COMPLETE',
      detail: missing.length ? `Не хватает: ${missing.join(', ')}` : 'Пакет документов полный.',
    },
  ];

  return {
    status: missing.length || !signed ? 'attention' : 'ready',
    items,
  };
}
