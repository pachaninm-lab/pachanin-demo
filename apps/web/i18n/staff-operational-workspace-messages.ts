import type { AppLocale } from './locale';

export type StaffOperationalWorkspaceCopy = {
  title: string;
  lead: string;
  locked: string;
  refresh: string;
  loading: string;
  empty: string;
  failed: string;
  saved: string;
  tabs: {
    support: string;
    operations: string;
    finance: string;
    diagnostics: string;
    people: string;
    critical: string;
    emergency: string;
  };
  labels: Record<string, string>;
  actions: Record<string, string>;
  roles: Record<string, string>;
};

const ru: StaffOperationalWorkspaceCopy = {
  title: 'Рабочие контуры платформы',
  lead: 'Очереди поддержки, исполнения, денег, диагностики и доступа.',
  locked: 'Сначала активируй защищённую staff-сессию в Центре управления доступом. Постоянное назначение роли само по себе не открывает клиентские данные.',
  refresh: 'Обновить', loading: 'Загрузка…', empty: 'Нет элементов, требующих внимания.', failed: 'Не удалось загрузить рабочий контур.', saved: 'Изменение сохранено.',
  tabs: { support: 'Поддержка', operations: 'Исполнение', finance: 'Деньги', diagnostics: 'Диагностика', people: 'Сотрудники', critical: 'Двухконтрольные действия', emergency: 'Аварийный доступ' },
  labels: {
    deal: 'Сделка', organization: 'Организация', status: 'Статус', nextAction: 'Следующий шаг', sla: 'SLA', blocker: 'Блокер', updated: 'Обновлено', seller: 'Продавец', buyer: 'Покупатель', shipments: 'Перевозки', documents: 'Документы', disputes: 'Открытые споры', payment: 'Платёж', callbacks: 'Callback', amount: 'Сумма, коп.', bankOperation: 'Банковая операция', adapter: 'Адаптер', event: 'Событие', error: 'Ошибка', retries: 'Повторы', correlation: 'Correlation ID', actor: 'Сотрудник', role: 'Внутренняя роль', validUntil: 'Действует до', reason: 'Основание', userId: 'ID пользователя', request: 'Запрос', resource: 'Ресурс', approvals: 'Одобрения', expires: 'Истекает', ticket: 'Обращение/инцидент', kyc: 'KYC/AML', active: 'Активно', mode: 'Режим', members: 'Пользователи', mfa: 'MFA', dealNumber: 'Номер сделки', runtime: 'Runtime', outbox: 'Outbox', integration: 'Интеграция', forbidden: 'Недостаточно полномочий активной staff-сессии.'
  },
  actions: { open: 'Открыть', close: 'Закрыть', approve: 'Одобрить', deny: 'Отклонить', create: 'Назначить роль', revoke: 'Отозвать', verify: 'Проверить цепочку аудита', end: 'Завершить', loadUsers: 'Показать пользователей', confirm: 'Подтверждаю аварийное завершение', decisionReason: 'Основание решения', assignmentReason: 'Основание назначения', revokeReason: 'Основание отзыва' },
  roles: { PLATFORM_OWNER: 'Владелец платформы', PLATFORM_ADMIN: 'Администратор платформы', SUPPORT_L1: 'Поддержка L1', SUPPORT_L2: 'Поддержка L2', OPERATIONS_AGENT: 'Оператор исполнения', OPERATIONS_SUPERVISOR: 'Руководитель операций', FINANCE_OPS: 'Финансовые операции', COMPLIANCE_STAFF: 'Комплаенс платформы', DEVELOPER: 'Разработчик', SRE_ONCALL: 'Дежурный SRE', SECURITY_AUDITOR: 'Аудитор безопасности', BREAK_GLASS_ADMIN: 'Аварийный администратор' },
};

const en: StaffOperationalWorkspaceCopy = {
  title: 'Platform staff workspaces',
  lead: 'Support, execution, money, diagnostics and access queues.',
  locked: 'Activate a protected staff session in Access Control first. A standing staff assignment never opens customer data by itself.',
  refresh: 'Refresh', loading: 'Loading…', empty: 'Nothing currently requires attention.', failed: 'The workspace could not be loaded.', saved: 'The change was saved.',
  tabs: { support: 'Support', operations: 'Execution', finance: 'Money', diagnostics: 'Diagnostics', people: 'Staff', critical: 'Dual-control actions', emergency: 'Emergency access' },
  labels: { deal: 'Deal', organization: 'Organization', status: 'Status', nextAction: 'Next action', sla: 'SLA', blocker: 'Blocker', updated: 'Updated', seller: 'Seller', buyer: 'Buyer', shipments: 'Shipments', documents: 'Documents', disputes: 'Open disputes', payment: 'Payment', callbacks: 'Callback', amount: 'Amount, kopecks', bankOperation: 'Bank operation', adapter: 'Adapter', event: 'Event', error: 'Error', retries: 'Retries', correlation: 'Correlation ID', actor: 'Staff actor', role: 'Staff role', validUntil: 'Valid until', reason: 'Reason', userId: 'User ID', request: 'Request', resource: 'Resource', approvals: 'Approvals', expires: 'Expires', ticket: 'Ticket/incident', kyc: 'KYC/AML', active: 'Active', mode: 'Mode', members: 'Users', mfa: 'MFA', dealNumber: 'Deal number', runtime: 'Runtime', outbox: 'Outbox', integration: 'Integration', forbidden: 'The active staff session does not have this permission.' },
  actions: { open: 'Open', close: 'Close', approve: 'Approve', deny: 'Deny', create: 'Assign role', revoke: 'Revoke', verify: 'Verify audit chain', end: 'End', loadUsers: 'Show users', confirm: 'I confirm emergency termination', decisionReason: 'Decision reason', assignmentReason: 'Assignment reason', revokeReason: 'Revocation reason' },
  roles: { PLATFORM_OWNER: 'Platform owner', PLATFORM_ADMIN: 'Platform administrator', SUPPORT_L1: 'Support L1', SUPPORT_L2: 'Support L2', OPERATIONS_AGENT: 'Operations agent', OPERATIONS_SUPERVISOR: 'Operations supervisor', FINANCE_OPS: 'Finance operations', COMPLIANCE_STAFF: 'Platform compliance', DEVELOPER: 'Developer', SRE_ONCALL: 'SRE on-call', SECURITY_AUDITOR: 'Security auditor', BREAK_GLASS_ADMIN: 'Break-glass administrator' },
};

const zh: StaffOperationalWorkspaceCopy = {
  title: '平台员工工作台',
  lead: '支持、履约、资金、诊断和访问队列。',
  locked: '请先在访问控制中心激活受保护的员工会话。长期角色分配本身不会开放客户数据。',
  refresh: '刷新', loading: '加载中…', empty: '当前没有需要处理的项目。', failed: '无法加载工作台。', saved: '更改已保存。',
  tabs: { support: '支持', operations: '履约', finance: '资金', diagnostics: '诊断', people: '员工', critical: '双人控制操作', emergency: '紧急访问' },
  labels: { deal: '交易', organization: '组织', status: '状态', nextAction: '下一步', sla: 'SLA', blocker: '阻塞项', updated: '更新时间', seller: '卖方', buyer: '买方', shipments: '运输', documents: '文件', disputes: '未结争议', payment: '付款', callbacks: '回调', amount: '金额（戈比）', bankOperation: '银行操作', adapter: '适配器', event: '事件', error: '错误', retries: '重试', correlation: '关联 ID', actor: '实际员工', role: '员工角色', validUntil: '有效期至', reason: '理由', userId: '用户 ID', request: '请求', resource: '资源', approvals: '批准数', expires: '到期', ticket: '工单/事件', kyc: 'KYC/AML', active: '有效', mode: '模式', members: '用户', mfa: 'MFA', dealNumber: '交易编号', runtime: '运行时', outbox: '发件箱', integration: '集成', forbidden: '当前员工会话没有该权限。' },
  actions: { open: '打开', close: '关闭', approve: '批准', deny: '拒绝', create: '分配角色', revoke: '撤销', verify: '验证审计链', end: '结束', loadUsers: '显示用户', confirm: '我确认结束紧急访问', decisionReason: '决策理由', assignmentReason: '分配理由', revokeReason: '撤销理由' },
  roles: { PLATFORM_OWNER: '平台所有者', PLATFORM_ADMIN: '平台管理员', SUPPORT_L1: '一级支持', SUPPORT_L2: '二级支持', OPERATIONS_AGENT: '履约运营', OPERATIONS_SUPERVISOR: '运营主管', FINANCE_OPS: '财务运营', COMPLIANCE_STAFF: '平台合规', DEVELOPER: '开发人员', SRE_ONCALL: '值班 SRE', SECURITY_AUDITOR: '安全审计员', BREAK_GLASS_ADMIN: '紧急管理员' },
};

export const staffOperationalWorkspaceMessages: Record<AppLocale, StaffOperationalWorkspaceCopy> = { ru, en, zh };
