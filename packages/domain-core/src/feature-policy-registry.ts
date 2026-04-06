export type FeaturePolicy = {
  code: string;
  title: string;
  description: string;
  modes: Array<'demo' | 'pilot' | 'live-safe'>;
  roles?: string[];
  liveOnly?: boolean;
};

const POLICIES: FeaturePolicy[] = [
  { code: 'execution_core', title: 'Контур исполнения сделки', description: 'Сделка, документы, логистика, деньги и спор.', modes: ['demo', 'pilot', 'live-safe'] },
  { code: 'money_release', title: 'Денежный контур', description: 'Reserve / hold / partial / final release.', modes: ['pilot', 'live-safe'], roles: ['finance', 'risk', 'admin'], liveOnly: true },
  { code: 'dispute_pack', title: 'Dispute pack и арбитражный контур', description: 'Сбор доказательств, owner, SLA и money impact.', modes: ['pilot', 'live-safe'] },
  { code: 'operator_overrides', title: 'Операторские override', description: 'Ручное вмешательство по правилам и с ledger.', modes: ['pilot', 'live-safe'], roles: ['support_manager', 'admin', 'risk'] },
  { code: 'ntb_bridge', title: 'NTB bridge', description: 'Сигнал ready_for_ntb и экспорт пакета.', modes: ['pilot', 'live-safe'], roles: ['executive', 'admin'], liveOnly: false },
  { code: 'bank_bridge', title: 'Bank bridge', description: 'Callback reconciliation и банк-пакеты.', modes: ['pilot', 'live-safe'], roles: ['finance', 'admin'], liveOnly: true },
  { code: 'offline_conflicts', title: 'Offline conflict center', description: 'Конфликты поздней синхронизации и правила разрешения.', modes: ['demo', 'pilot', 'live-safe'], roles: ['driver', 'logistics', 'receiving', 'lab', 'support_manager'] },
  { code: 'ai_execution_copilot', title: 'Execution copilot', description: 'Следующий шаг, document gap, dispute summary и incident explanation.', modes: ['demo', 'pilot', 'live-safe'] }
];

export function listFeaturePolicies() {
  return [...POLICIES];
}

export function resolveFeaturePolicies(runMode: 'demo' | 'pilot' | 'live-safe') {
  return POLICIES.filter((item) => item.modes.includes(runMode));
}
