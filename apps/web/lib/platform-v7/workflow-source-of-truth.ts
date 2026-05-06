import { AuditEvent, EntityId, PlatformRole } from './core-types';
import { createAuditEvent } from './audit-events';

export type WorkflowActionContext = 'seller' | 'buyer' | 'deal' | 'operator';

export type WorkflowActionKind =
  | 'publish_market_lot'
  | 'send_buyer_offer'
  | 'accept_offer_to_draft'
  | 'confirm_money_reserve'
  | 'request_document_preview'
  | 'block_contact_leak'
  | 'open_manual_review';

export interface WorkflowState {
  batchStatus: string;
  lotStatus: string;
  offerStatus: string;
  dealDraftStatus: string;
  moneyStatus: string;
  documentStatus: string;
  logisticsStatus: string;
  bypassStatus: string;
  nextAction: string;
  updatedAt: string;
}

export interface WorkflowActionDefinition {
  kind: WorkflowActionKind;
  label: string;
  actorRole: PlatformRole;
  entityType: string;
  entityId: EntityId;
  dealId?: EntityId;
  reason?: string;
  description: string;
}

export interface WorkflowActionResult {
  state: WorkflowState;
  auditEvent: AuditEvent;
  toast: string;
}

export interface WorkflowDashboardModel {
  context: WorkflowActionContext;
  title: string;
  lead: string;
  state: WorkflowState;
  actions: WorkflowActionDefinition[];
  auditSeed: AuditEvent[];
}

const baseState: WorkflowState = {
  batchStatus: 'партия готова к публикации',
  lotStatus: 'лот доступен проверенным покупателям',
  offerStatus: 'оффер ожидает решения',
  dealDraftStatus: 'черновик сделки ещё не создан',
  moneyStatus: 'резерв денег не подтверждён',
  documentStatus: 'СДИЗ и ЭТрН требуют закрытия',
  logisticsStatus: 'логистика включается после принятия условий',
  bypassStatus: 'прямые контакты скрыты до допустимой стадии',
  nextAction: 'выбрать действие внутри платформы',
  updatedAt: 'сейчас',
};

function seedAudit(context: WorkflowActionContext): AuditEvent[] {
  return [
    createAuditEvent({
      entityType: 'workflow',
      entityId: `${context}-seed`,
      actorRole: context === 'buyer' ? 'buyer' : context === 'operator' ? 'operator' : 'seller',
      actorId: `${context.toUpperCase()}-001`,
      action: 'workflow_opened',
      after: { context, state: 'ready' },
      reason: 'Открыта рабочая поверхность исполнения сделки',
    }),
  ];
}

export const workflowDashboardModels: Record<WorkflowActionContext, WorkflowDashboardModel> = {
  seller: {
    context: 'seller',
    title: 'Действия продавца по сделке',
    lead: 'Продавец публикует лот, принимает оффер и видит, почему деньги ещё не выпущены. Каждое действие меняет состояние и попадает в журнал.',
    state: baseState,
    actions: [
      {
        kind: 'publish_market_lot',
        label: 'Опубликовать лот в рынок',
        actorRole: 'seller',
        entityType: 'market_lot',
        entityId: 'LOT-2405',
        description: 'Лот становится доступен проверенным покупателям без раскрытия телефона, точного адреса и полных документов.',
      },
      {
        kind: 'accept_offer_to_draft',
        label: 'Принять оффер',
        actorRole: 'seller',
        entityType: 'offer',
        entityId: 'OFF-2405-B4',
        dealId: 'DL-9106',
        reason: 'Лучший чистый результат при допустимом рейтинге покупателя',
        description: 'Принятие не завершает продажу, а создаёт черновик сделки с условиями по деньгам, документам и логистике.',
      },
      {
        kind: 'request_document_preview',
        label: 'Открыть защищённый просмотр',
        actorRole: 'seller',
        entityType: 'document',
        entityId: 'DOC-SDIZ-2405',
        dealId: 'DL-9106',
        description: 'Документ открывается в режиме просмотра с водяным знаком и записью в журнале.',
      },
    ],
    auditSeed: seedAudit('seller'),
  },
  buyer: {
    context: 'buyer',
    title: 'Действия покупателя по закупке',
    lead: 'Покупатель создаёт оффер, подтверждает резерв и видит цену до своей точки. Чужие закрытые ставки и прямые контакты не раскрываются.',
    state: { ...baseState, nextAction: 'создать оффер или подтвердить резерв денег' },
    actions: [
      {
        kind: 'send_buyer_offer',
        label: 'Сделать оффер',
        actorRole: 'buyer',
        entityType: 'offer',
        entityId: 'OFF-2405-B4',
        description: 'Оффер фиксирует цену, объём, базис, документы и срок действия. Устные условия не меняют сделку.',
      },
      {
        kind: 'confirm_money_reserve',
        label: 'Подтвердить резерв денег',
        actorRole: 'buyer',
        entityType: 'money_plan',
        entityId: 'MONEY-DL-9106',
        dealId: 'DL-9106',
        reason: 'Покупатель подтверждает готовность расчётного контура',
        description: 'Резерв подтверждает готовность денег, но выпуск продавцу остаётся заблокирован до документов, приёмки и качества.',
      },
      {
        kind: 'request_document_preview',
        label: 'Запросить документ',
        actorRole: 'buyer',
        entityType: 'document',
        entityId: 'DOC-QUALITY-2405',
        dealId: 'DL-9106',
        description: 'До нужной стадии открывается только безопасный просмотр без лишних реквизитов и контактов.',
      },
    ],
    auditSeed: seedAudit('buyer'),
  },
  deal: {
    context: 'deal',
    title: 'Действия по сделке',
    lead: 'Деньги, документы, рейс, качество и спор меняют один объект сделки. Любой шаг должен иметь состояние, ответственного и журнал.',
    state: { ...baseState, dealDraftStatus: 'черновик сделки создан, ждёт план денег, документов и логистики', nextAction: 'закрыть обязательные условия сделки' },
    actions: [
      {
        kind: 'confirm_money_reserve',
        label: 'Подтвердить денежный план',
        actorRole: 'buyer',
        entityType: 'deal_draft',
        entityId: 'DRAFT-DL-9106',
        dealId: 'DL-9106',
        reason: 'Проверка готовности денег перед исполнением',
        description: 'Денежный план закрывает только одно условие. Документы, СДИЗ, логистика и риск обхода проверяются отдельно.',
      },
      {
        kind: 'block_contact_leak',
        label: 'Заблокировать контакт вне сделки',
        actorRole: 'operator',
        entityType: 'bypass_signal',
        entityId: 'BYP-DL-9106-01',
        dealId: 'DL-9106',
        reason: 'Попытка передать контакт до допустимой стадии',
        description: 'Контакт маскируется, сделка остаётся внутри платформы, риск попадает оператору.',
      },
      {
        kind: 'open_manual_review',
        label: 'Передать оператору',
        actorRole: 'operator',
        entityType: 'deal',
        entityId: 'DL-9106',
        dealId: 'DL-9106',
        reason: 'Требуется ручная проверка условий выпуска денег',
        description: 'Ручное действие не скрывает факт: оно создаёт след и ограничивает необратимые шаги до решения.',
      },
    ],
    auditSeed: seedAudit('deal'),
  },
  operator: {
    context: 'operator',
    title: 'Операторский контроль антиобхода',
    lead: 'Оператор видит сигнал, сумму риска, раскрытые данные и ограничения. Каждое снятие или усиление риска фиксируется.',
    state: { ...baseState, bypassStatus: 'есть сигнал среднего риска', nextAction: 'проверить сигнал и выбрать ограничение' },
    actions: [
      {
        kind: 'block_contact_leak',
        label: 'Включить ограничение контактов',
        actorRole: 'operator',
        entityType: 'bypass_signal',
        entityId: 'BYP-DL-9106-02',
        dealId: 'DL-9106',
        reason: 'Контакты запрошены до черновика сделки',
        description: 'Система ограничивает контакты и документы, но не делает публичных обвинений.',
      },
      {
        kind: 'open_manual_review',
        label: 'Назначить ручную проверку',
        actorRole: 'operator',
        entityType: 'counterparty',
        entityId: 'BUYER-184',
        reason: 'Повторные действия без продвижения сделки',
        description: 'Контрагент переводится в усиленный контроль до объяснения причин.',
      },
    ],
    auditSeed: seedAudit('operator'),
  },
};

export function getWorkflowDashboardModel(context: WorkflowActionContext): WorkflowDashboardModel {
  return workflowDashboardModels[context];
}

export function runWorkflowAction(action: WorkflowActionDefinition, currentState: WorkflowState): WorkflowActionResult {
  const nextState = reduceWorkflowState(action.kind, currentState);
  const auditEvent = createAuditEvent({
    entityType: action.entityType,
    entityId: action.entityId,
    actorRole: action.actorRole,
    actorId: `${action.actorRole.toUpperCase()}-001`,
    action: action.kind,
    dealId: action.dealId,
    before: currentState,
    after: nextState,
    reason: action.reason || action.description,
  });

  return {
    state: nextState,
    auditEvent,
    toast: toastForAction(action.kind),
  };
}

function reduceWorkflowState(kind: WorkflowActionKind, currentState: WorkflowState): WorkflowState {
  const updatedAt = 'обновлено сейчас';
  switch (kind) {
    case 'publish_market_lot':
      return {
        ...currentState,
        lotStatus: 'лот опубликован как управляемый рыночный лот',
        offerStatus: 'ожидаются офферы проверенных покупателей',
        bypassStatus: 'контакты и точный адрес скрыты',
        nextAction: 'проверить входящие офферы и рейтинг покупателя',
        updatedAt,
      };
    case 'send_buyer_offer':
      return {
        ...currentState,
        offerStatus: 'оффер отправлен продавцу',
        dealDraftStatus: 'ожидает принятия условий',
        nextAction: 'дождаться решения продавца или встречного предложения',
        updatedAt,
      };
    case 'accept_offer_to_draft':
      return {
        ...currentState,
        offerStatus: 'оффер принят',
        dealDraftStatus: 'черновик сделки создан',
        moneyStatus: 'требуется денежный план',
        documentStatus: 'требуется документный план',
        logisticsStatus: 'требуется план логистики',
        nextAction: 'закрыть денежный, документный и логистический план',
        updatedAt,
      };
    case 'confirm_money_reserve':
      return {
        ...currentState,
        moneyStatus: 'резерв денег подтверждён, выпуск продавцу ещё закрыт',
        dealDraftStatus: 'денежное условие закрыто',
        nextAction: 'закрыть документы, СДИЗ, рейс, приёмку и качество',
        updatedAt,
      };
    case 'request_document_preview':
      return {
        ...currentState,
        documentStatus: 'документ открыт в защищённом просмотре',
        bypassStatus: 'скачивание и контакты ограничены до допустимой стадии',
        nextAction: 'закрыть недостающие документы или запросить ручную проверку',
        updatedAt,
      };
    case 'block_contact_leak':
      return {
        ...currentState,
        bypassStatus: 'контакт замаскирован, создан сигнал риска',
        nextAction: 'оператор проверяет сигнал и ограничение доступа',
        updatedAt,
      };
    case 'open_manual_review':
      return {
        ...currentState,
        dealDraftStatus: 'ручная проверка включена',
        bypassStatus: 'необратимые действия ограничены до решения оператора',
        nextAction: 'оператор фиксирует решение и основание',
        updatedAt,
      };
    default:
      return { ...currentState, updatedAt };
  }
}

function toastForAction(kind: WorkflowActionKind): string {
  switch (kind) {
    case 'publish_market_lot':
      return 'Лот опубликован внутри управляемого контура. Контакты не раскрыты.';
    case 'send_buyer_offer':
      return 'Оффер отправлен. Условия зафиксированы версией и попадут в сделку после принятия.';
    case 'accept_offer_to_draft':
      return 'Оффер принят. Создан черновик сделки с условиями по деньгам, документам и логистике.';
    case 'confirm_money_reserve':
      return 'Резерв подтверждён. Выпуск денег продавцу остаётся закрыт до обязательных условий.';
    case 'request_document_preview':
      return 'Документ открыт в защищённом просмотре. Событие записано в журнал.';
    case 'block_contact_leak':
      return 'Контактные данные замаскированы. Сигнал передан в операторский контроль.';
    case 'open_manual_review':
      return 'Ручная проверка включена. Дальнейшие действия требуют основания в журнале.';
    default:
      return 'Действие выполнено и записано в журнал.';
  }
}
