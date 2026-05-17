import type { PlatformActionScope } from './action-log';
import type { PlatformV7ExecutionRole } from './execution-action-core';

export type PlatformV7RuntimeExternalSystem = 'fgis' | 'bank' | 'edo' | 'lab' | 'elevator' | 'none';
export type PlatformV7RuntimeTargetKind = 'party' | 'deal' | 'money' | 'document' | 'trip' | 'quality' | 'dispute';
export type PlatformV7RuntimeActionId =
  | 'request_fgis_check'
  | 'create_draft_deal'
  | 'request_bank_reserve_review'
  | 'request_bank_payment_basis_review'
  | 'confirm_weight_manually'
  | 'upload_lab_protocol'
  | 'attach_internal_document'
  | 'open_dispute_case'
  | 'record_field_evidence';

export type PlatformV7RuntimeResultState =
  | 'draft_created'
  | 'internal_record_created'
  | 'pending_external_confirmation'
  | 'pending_bank_review'
  | 'manual_review_required'
  | 'dispute_opened';

export interface PlatformV7RuntimeActionContract {
  readonly id: PlatformV7RuntimeActionId;
  readonly label: string;
  readonly targetKind: PlatformV7RuntimeTargetKind;
  readonly scope: PlatformActionScope;
  readonly allowedRoles: readonly PlatformV7ExecutionRole[];
  readonly externalSystem: PlatformV7RuntimeExternalSystem;
  readonly requiresExternalConfirmation: boolean;
  readonly resultingState: PlatformV7RuntimeResultState;
  readonly auditEventType: string;
  readonly copySafetyNote: string;
  readonly doesNotConfirmExternally: true;
}

export const PLATFORM_V7_RUNTIME_ACTION_CONTRACTS: readonly PlatformV7RuntimeActionContract[] = [
  {
    id: 'request_fgis_check',
    label: 'Запросить сверку ФГИС',
    targetKind: 'party',
    scope: 'lot',
    allowedRoles: ['operator', 'seller'],
    externalSystem: 'fgis',
    requiresExternalConfirmation: true,
    resultingState: 'pending_external_confirmation',
    auditEventType: 'fgis_check_requested',
    copySafetyNote: 'Создаёт запрос сверки. Не подтверждает ФГИС, партию, остаток или СДИЗ без внешнего события.',
    doesNotConfirmExternally: true,
  },
  {
    id: 'create_draft_deal',
    label: 'Создать черновик сделки',
    targetKind: 'deal',
    scope: 'deal',
    allowedRoles: ['operator', 'buyer', 'seller'],
    externalSystem: 'none',
    requiresExternalConfirmation: false,
    resultingState: 'draft_created',
    auditEventType: 'draft_deal_created',
    copySafetyNote: 'Создаёт только черновик сделки. Не запускает оплату, банк, ЭДО или внешнее подтверждение.',
    doesNotConfirmExternally: true,
  },
  {
    id: 'request_bank_reserve_review',
    label: 'Запросить банковскую проверку резерва',
    targetKind: 'money',
    scope: 'bank',
    allowedRoles: ['operator', 'buyer'],
    externalSystem: 'bank',
    requiresExternalConfirmation: true,
    resultingState: 'pending_bank_review',
    auditEventType: 'bank_reserve_review_requested',
    copySafetyNote: 'Создаёт запрос на проверку резерва. Не подтверждает резерв и не создаёт движение денег без ответа банка.',
    doesNotConfirmExternally: true,
  },
  {
    id: 'request_bank_payment_basis_review',
    label: 'Передать основание банку',
    targetKind: 'money',
    scope: 'bank',
    allowedRoles: ['operator'],
    externalSystem: 'bank',
    requiresExternalConfirmation: true,
    resultingState: 'pending_bank_review',
    auditEventType: 'bank_payment_basis_review_requested',
    copySafetyNote: 'Передаёт основание на банковскую проверку. Не выпускает деньги и не подтверждает выплату силами платформы.',
    doesNotConfirmExternally: true,
  },
  {
    id: 'confirm_weight_manually',
    label: 'Зафиксировать вес вручную',
    targetKind: 'trip',
    scope: 'elevator',
    allowedRoles: ['operator', 'elevator'],
    externalSystem: 'elevator',
    requiresExternalConfirmation: true,
    resultingState: 'manual_review_required',
    auditEventType: 'weight_manual_record_created',
    copySafetyNote: 'Фиксирует ручную запись веса. Не подтверждает вес внешнего элеватора без отдельного события или документа.',
    doesNotConfirmExternally: true,
  },
  {
    id: 'upload_lab_protocol',
    label: 'Приложить лабораторный протокол',
    targetKind: 'quality',
    scope: 'lab',
    allowedRoles: ['operator', 'lab'],
    externalSystem: 'lab',
    requiresExternalConfirmation: true,
    resultingState: 'manual_review_required',
    auditEventType: 'lab_protocol_uploaded',
    copySafetyNote: 'Прикладывает протокол как основание проверки. Не подтверждает внешний лабораторный результат без верификации источника.',
    doesNotConfirmExternally: true,
  },
  {
    id: 'attach_internal_document',
    label: 'Приложить внутренний документ',
    targetKind: 'document',
    scope: 'deal',
    allowedRoles: ['operator', 'buyer', 'seller'],
    externalSystem: 'none',
    requiresExternalConfirmation: false,
    resultingState: 'internal_record_created',
    auditEventType: 'internal_document_attached',
    copySafetyNote: 'Фиксирует внутренний документ. Не является ЭДО, УКЭП или внешним подтверждением.',
    doesNotConfirmExternally: true,
  },
  {
    id: 'open_dispute_case',
    label: 'Открыть спор',
    targetKind: 'dispute',
    scope: 'dispute',
    allowedRoles: ['operator', 'buyer', 'seller'],
    externalSystem: 'none',
    requiresExternalConfirmation: false,
    resultingState: 'dispute_opened',
    auditEventType: 'dispute_opened',
    copySafetyNote: 'Создаёт спор и доказательный контур. Не принимает решение и не меняет деньги без процедуры и банковского основания.',
    doesNotConfirmExternally: true,
  },
  {
    id: 'record_field_evidence',
    label: 'Зафиксировать полевое доказательство',
    targetKind: 'trip',
    scope: 'logistics',
    allowedRoles: ['operator', 'driver', 'logistics', 'elevator'],
    externalSystem: 'none',
    requiresExternalConfirmation: false,
    resultingState: 'internal_record_created',
    auditEventType: 'field_evidence_recorded',
    copySafetyNote: 'Создаёт внутреннее доказательство. Не заявляет GPS, фото или пломбу как внешне подтверждённые без источника.',
    doesNotConfirmExternally: true,
  },
] as const;

export function platformV7RuntimeActionContract(id: PlatformV7RuntimeActionId): PlatformV7RuntimeActionContract | null {
  return PLATFORM_V7_RUNTIME_ACTION_CONTRACTS.find((contract) => contract.id === id) ?? null;
}

export function platformV7RuntimeActionsForRole(role: PlatformV7ExecutionRole): readonly PlatformV7RuntimeActionContract[] {
  return PLATFORM_V7_RUNTIME_ACTION_CONTRACTS.filter((contract) => contract.allowedRoles.includes(role));
}

export function platformV7RuntimeActionRequiresExternalConfirmation(id: PlatformV7RuntimeActionId): boolean {
  return platformV7RuntimeActionContract(id)?.requiresExternalConfirmation ?? false;
}
