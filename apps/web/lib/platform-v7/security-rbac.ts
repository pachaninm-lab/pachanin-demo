export type PlatformV7SecurityRole =
  | 'seller'
  | 'buyer'
  | 'logistics'
  | 'driver'
  | 'elevator'
  | 'lab'
  | 'surveyor'
  | 'bank'
  | 'operator'
  | 'compliance'
  | 'arbitrator'
  | 'support_agent'
  | 'executive'
  | 'investor';

export type PlatformV7ProtectedResource =
  | 'deal'
  | 'money'
  | 'document'
  | 'trip'
  | 'support_case'
  | 'audit_event'
  | 'counterparty_rating'
  | 'integration_event'
  | 'investor_summary'
  | 'aggregate_report'
  | 'driver_field';

export type PlatformV7AccessLevel = 'none' | 'own' | 'linked' | 'role_scope' | 'all' | 'read_only';

export type PlatformV7SecurityRule = {
  readonly role: PlatformV7SecurityRole;
  readonly resource: PlatformV7ProtectedResource;
  readonly access: PlatformV7AccessLevel;
  readonly canRead: boolean;
  readonly canWrite: boolean;
  readonly canSeeMoneyAmount: boolean;
  readonly requiresEntityLink: boolean;
  readonly summary: string;
};

const driverNoMoney = 'Водитель видит только свой рейс, полевые действия и связанные инструкции. Деньги, банк, инвесторские и общие контуры скрыты.';
const investorReadOnly = 'Инвестор видит агрегированный read-only контур без операционного вмешательства, персональных документов и полевых действий.';
const executiveReadOnly = 'Руководитель видит только агрегаты без операционного доступа к сделкам, деньгам, документам, рейсам и обращениям.';
const supportScopeOnly = 'SupportAgent работает с обращениями и связанными сделками без доступа к деньгам и банковским действиям.';

export const PLATFORM_V7_SECURITY_RULES: readonly PlatformV7SecurityRule[] = [
  { role: 'seller', resource: 'deal', access: 'own', canRead: true, canWrite: true, canSeeMoneyAmount: true, requiresEntityLink: true, summary: 'Продавец работает только со своими сделками и связанными действиями.' },
  { role: 'seller', resource: 'money', access: 'own', canRead: true, canWrite: false, canSeeMoneyAmount: true, requiresEntityLink: true, summary: 'Продавец видит деньги по своей сделке, но не управляет банковским событием.' },
  { role: 'seller', resource: 'document', access: 'own', canRead: true, canWrite: true, canSeeMoneyAmount: false, requiresEntityLink: true, summary: 'Продавец видит и загружает документы только по своей стороне сделки.' },
  { role: 'buyer', resource: 'deal', access: 'own', canRead: true, canWrite: true, canSeeMoneyAmount: true, requiresEntityLink: true, summary: 'Покупатель работает только со своими закупками и связанными сделками.' },
  { role: 'buyer', resource: 'money', access: 'own', canRead: true, canWrite: false, canSeeMoneyAmount: true, requiresEntityLink: true, summary: 'Покупатель видит резерв и удержания по своей сделке, но не выпускает деньги сам.' },
  { role: 'buyer', resource: 'document', access: 'own', canRead: true, canWrite: true, canSeeMoneyAmount: false, requiresEntityLink: true, summary: 'Покупатель видит документы только по своей сделке и своей роли.' },
  { role: 'logistics', resource: 'trip', access: 'role_scope', canRead: true, canWrite: true, canSeeMoneyAmount: false, requiresEntityLink: true, summary: 'Логистика управляет связанными рейсами без доступа к банковскому управлению.' },
  { role: 'driver', resource: 'trip', access: 'own', canRead: true, canWrite: true, canSeeMoneyAmount: false, requiresEntityLink: true, summary: driverNoMoney },
  { role: 'driver', resource: 'deal', access: 'none', canRead: false, canWrite: false, canSeeMoneyAmount: false, requiresEntityLink: true, summary: driverNoMoney },
  { role: 'driver', resource: 'money', access: 'none', canRead: false, canWrite: false, canSeeMoneyAmount: false, requiresEntityLink: true, summary: driverNoMoney },
  { role: 'driver', resource: 'audit_event', access: 'none', canRead: false, canWrite: false, canSeeMoneyAmount: false, requiresEntityLink: true, summary: driverNoMoney },
  { role: 'driver', resource: 'investor_summary', access: 'none', canRead: false, canWrite: false, canSeeMoneyAmount: false, requiresEntityLink: true, summary: driverNoMoney },
  { role: 'elevator', resource: 'document', access: 'linked', canRead: true, canWrite: true, canSeeMoneyAmount: false, requiresEntityLink: true, summary: 'Элеватор видит только связанные приёмочные документы, вес и события приёмки.' },
  { role: 'lab', resource: 'document', access: 'linked', canRead: true, canWrite: true, canSeeMoneyAmount: false, requiresEntityLink: true, summary: 'Лаборатория работает только с протоколом, пробой и связанными доказательствами качества.' },
  { role: 'surveyor', resource: 'document', access: 'linked', canRead: true, canWrite: true, canSeeMoneyAmount: false, requiresEntityLink: true, summary: 'Сюрвейер видит связанные доказательства, осмотр и спорные факты.' },
  { role: 'bank', resource: 'money', access: 'role_scope', canRead: true, canWrite: true, canSeeMoneyAmount: true, requiresEntityLink: true, summary: 'Банк видит денежный контур и фиксирует банковские события в пределах подключённой сделки.' },
  { role: 'bank', resource: 'document', access: 'linked', canRead: true, canWrite: false, canSeeMoneyAmount: false, requiresEntityLink: true, summary: 'Банк читает документы как основание, но не подменяет ЭДО или сторону сделки.' },
  { role: 'bank', resource: 'trip', access: 'none', canRead: false, canWrite: false, canSeeMoneyAmount: false, requiresEntityLink: true, summary: 'Банк не видит полевой рейсовый контур и действия водителя.' },
  { role: 'bank', resource: 'support_case', access: 'none', canRead: false, canWrite: false, canSeeMoneyAmount: false, requiresEntityLink: true, summary: 'Банк не работает с обращениями поддержки.' },
  { role: 'bank', resource: 'driver_field', access: 'none', canRead: false, canWrite: false, canSeeMoneyAmount: false, requiresEntityLink: true, summary: 'Банк не открывает водительский полевой экран.' },
  { role: 'operator', resource: 'support_case', access: 'all', canRead: true, canWrite: true, canSeeMoneyAmount: true, requiresEntityLink: false, summary: 'Оператор видит очередь обращений, связи со сделкой и SLA без подмены банка или арбитра.' },
  { role: 'operator', resource: 'audit_event', access: 'all', canRead: true, canWrite: false, canSeeMoneyAmount: true, requiresEntityLink: false, summary: 'Оператор читает журнал для сопровождения, но append-only события создаются действиями системы.' },
  { role: 'compliance', resource: 'counterparty_rating', access: 'all', canRead: true, canWrite: true, canSeeMoneyAmount: false, requiresEntityLink: false, summary: 'Комплаенс работает с риском, проверками, стоп-факторами и основаниями ограничения доступа.' },
  { role: 'compliance', resource: 'integration_event', access: 'all', canRead: true, canWrite: false, canSeeMoneyAmount: false, requiresEntityLink: false, summary: 'Комплаенс читает статусы внешних подключений и ручных проверок.' },
  { role: 'arbitrator', resource: 'deal', access: 'linked', canRead: true, canWrite: false, canSeeMoneyAmount: true, requiresEntityLink: true, summary: 'Арбитр читает связанную сделку для спора без изменения коммерческих условий.' },
  { role: 'arbitrator', resource: 'document', access: 'linked', canRead: true, canWrite: false, canSeeMoneyAmount: false, requiresEntityLink: true, summary: 'Арбитр читает доказательства и документы только по открытому спору.' },
  { role: 'arbitrator', resource: 'money', access: 'none', canRead: false, canWrite: false, canSeeMoneyAmount: false, requiresEntityLink: true, summary: 'Арбитр принимает решение по спору, но не читает и не двигает денежный контур.' },
  { role: 'support_agent', resource: 'deal', access: 'role_scope', canRead: true, canWrite: false, canSeeMoneyAmount: false, requiresEntityLink: true, summary: supportScopeOnly },
  { role: 'support_agent', resource: 'support_case', access: 'role_scope', canRead: true, canWrite: true, canSeeMoneyAmount: false, requiresEntityLink: true, summary: supportScopeOnly },
  { role: 'support_agent', resource: 'money', access: 'none', canRead: false, canWrite: false, canSeeMoneyAmount: false, requiresEntityLink: true, summary: supportScopeOnly },
  { role: 'investor', resource: 'investor_summary', access: 'read_only', canRead: true, canWrite: false, canSeeMoneyAmount: true, requiresEntityLink: false, summary: investorReadOnly },
  { role: 'investor', resource: 'aggregate_report', access: 'read_only', canRead: true, canWrite: false, canSeeMoneyAmount: true, requiresEntityLink: false, summary: investorReadOnly },
  { role: 'investor', resource: 'deal', access: 'none', canRead: false, canWrite: false, canSeeMoneyAmount: false, requiresEntityLink: true, summary: investorReadOnly },
  { role: 'investor', resource: 'money', access: 'none', canRead: false, canWrite: false, canSeeMoneyAmount: false, requiresEntityLink: true, summary: investorReadOnly },
  { role: 'investor', resource: 'document', access: 'none', canRead: false, canWrite: false, canSeeMoneyAmount: false, requiresEntityLink: true, summary: investorReadOnly },
  { role: 'investor', resource: 'trip', access: 'none', canRead: false, canWrite: false, canSeeMoneyAmount: false, requiresEntityLink: true, summary: investorReadOnly },
  { role: 'investor', resource: 'audit_event', access: 'none', canRead: false, canWrite: false, canSeeMoneyAmount: false, requiresEntityLink: true, summary: investorReadOnly },
  { role: 'investor', resource: 'support_case', access: 'none', canRead: false, canWrite: false, canSeeMoneyAmount: false, requiresEntityLink: true, summary: investorReadOnly },
  { role: 'executive', resource: 'aggregate_report', access: 'read_only', canRead: true, canWrite: false, canSeeMoneyAmount: true, requiresEntityLink: false, summary: executiveReadOnly },
  { role: 'executive', resource: 'deal', access: 'none', canRead: false, canWrite: false, canSeeMoneyAmount: false, requiresEntityLink: true, summary: executiveReadOnly },
  { role: 'executive', resource: 'money', access: 'none', canRead: false, canWrite: false, canSeeMoneyAmount: false, requiresEntityLink: true, summary: executiveReadOnly },
  { role: 'executive', resource: 'document', access: 'none', canRead: false, canWrite: false, canSeeMoneyAmount: false, requiresEntityLink: true, summary: executiveReadOnly },
  { role: 'executive', resource: 'trip', access: 'none', canRead: false, canWrite: false, canSeeMoneyAmount: false, requiresEntityLink: true, summary: executiveReadOnly },
  { role: 'executive', resource: 'audit_event', access: 'none', canRead: false, canWrite: false, canSeeMoneyAmount: false, requiresEntityLink: true, summary: executiveReadOnly },
  { role: 'executive', resource: 'support_case', access: 'none', canRead: false, canWrite: false, canSeeMoneyAmount: false, requiresEntityLink: true, summary: executiveReadOnly },
];

export function getPlatformV7SecurityRule(role: PlatformV7SecurityRole, resource: PlatformV7ProtectedResource) {
  return PLATFORM_V7_SECURITY_RULES.find((rule) => rule.role === role && rule.resource === resource);
}

export function canPlatformV7RoleRead(role: PlatformV7SecurityRole, resource: PlatformV7ProtectedResource): boolean {
  return getPlatformV7SecurityRule(role, resource)?.canRead === true;
}

export function canPlatformV7RoleWrite(role: PlatformV7SecurityRole, resource: PlatformV7ProtectedResource): boolean {
  return getPlatformV7SecurityRule(role, resource)?.canWrite === true;
}

export function canPlatformV7RoleSeeMoneyAmount(role: PlatformV7SecurityRole, resource: PlatformV7ProtectedResource): boolean {
  return getPlatformV7SecurityRule(role, resource)?.canSeeMoneyAmount === true;
}

export function getPlatformV7DriverIsolationSummary() {
  return {
    canReadOwnTrip: canPlatformV7RoleRead('driver', 'trip'),
    canWriteOwnTrip: canPlatformV7RoleWrite('driver', 'trip'),
    canReadMoney: canPlatformV7RoleRead('driver', 'money'),
    canSeeMoneyAmount: canPlatformV7RoleSeeMoneyAmount('driver', 'money'),
    canReadInvestorSummary: canPlatformV7RoleRead('driver', 'investor_summary'),
  };
}

export function getPlatformV7InvestorBoundarySummary() {
  return {
    canReadSummary: canPlatformV7RoleRead('investor', 'investor_summary'),
    canWriteSummary: canPlatformV7RoleWrite('investor', 'investor_summary'),
    canReadDocuments: canPlatformV7RoleRead('investor', 'document'),
    canReadTrips: canPlatformV7RoleRead('investor', 'trip'),
  };
}
