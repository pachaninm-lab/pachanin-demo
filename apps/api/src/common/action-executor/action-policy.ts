import { Role } from '../types/request-user';

export type DomainAction =
  | 'deal.view'
  | 'deal.create'
  | 'deal.sign'
  | 'deal.transition'
  | 'money.reserve.request'
  | 'money.reserve.confirm'
  | 'money.release.request'
  | 'money.release.confirm'
  | 'money.adjust'
  | 'document.upload'
  | 'document.sign'
  | 'document.view'
  | 'shipment.create'
  | 'shipment.transition'
  | 'shipment.view'
  | 'shipment.checkpoint'
  | 'shipment.verify_pin'
  | 'lab.sample.create'
  | 'lab.sample.collect'
  | 'lab.test.record'
  | 'lab.protocol.finalize'
  | 'dispute.create'
  | 'dispute.triage'
  | 'dispute.evidence.upload'
  | 'dispute.decide'
  | 'lot.create'
  | 'lot.publish'
  | 'lot.view'
  | 'offer.create'
  | 'offer.accept';

// Mutations that must never be allowed to EXECUTIVE
export const MUTATION_ACTIONS: Set<DomainAction> = new Set([
  'deal.create', 'deal.sign', 'deal.transition',
  'money.reserve.request', 'money.reserve.confirm', 'money.release.request', 'money.release.confirm', 'money.adjust',
  'document.upload', 'document.sign',
  'shipment.create', 'shipment.transition', 'shipment.checkpoint', 'shipment.verify_pin',
  'lab.sample.create', 'lab.sample.collect', 'lab.test.record', 'lab.protocol.finalize',
  'dispute.create', 'dispute.triage', 'dispute.evidence.upload', 'dispute.decide',
  'lot.create', 'lot.publish',
  'offer.create', 'offer.accept',
]);

// Money operations require bank callback — cannot self-confirm
export const BANK_OUTBOX_ACTIONS: Set<DomainAction> = new Set([
  'money.reserve.request',
  'money.release.request',
]);

export const ROLE_ALLOWED_ACTIONS: Record<Role, Set<DomainAction>> = {
  [Role.ADMIN]: new Set([
    'deal.view', 'deal.create', 'deal.sign', 'deal.transition',
    'money.reserve.request', 'money.reserve.confirm', 'money.release.request', 'money.release.confirm', 'money.adjust',
    'document.upload', 'document.sign', 'document.view',
    'shipment.create', 'shipment.transition', 'shipment.view', 'shipment.checkpoint', 'shipment.verify_pin',
    'lab.sample.create', 'lab.sample.collect', 'lab.test.record', 'lab.protocol.finalize',
    'dispute.create', 'dispute.triage', 'dispute.evidence.upload', 'dispute.decide',
    'lot.create', 'lot.publish', 'lot.view',
    'offer.create', 'offer.accept',
  ]),
  [Role.SUPPORT_MANAGER]: new Set([
    'deal.view', 'deal.transition',
    'money.reserve.request', 'money.release.request',
    'document.view',
    'shipment.view', 'shipment.transition', 'shipment.checkpoint',
    'lab.sample.create', 'lab.sample.collect', 'lab.test.record', 'lab.protocol.finalize',
    'dispute.triage', 'dispute.decide', 'dispute.evidence.upload',
    'lot.view', 'offer.create', 'offer.accept',
  ]),
  // EXECUTIVE is strictly read-only — no write/mutation actions
  [Role.EXECUTIVE]: new Set([
    'deal.view',
    'document.view',
    'shipment.view',
    'lot.view',
  ]),
  [Role.FARMER]: new Set([
    'deal.view', 'deal.create', 'deal.sign', 'deal.transition',
    'document.upload', 'document.sign', 'document.view',
    'lot.create', 'lot.publish', 'lot.view',
    'dispute.create', 'dispute.evidence.upload',
    'shipment.view',
  ]),
  [Role.BUYER]: new Set([
    'deal.view', 'deal.create', 'deal.sign',
    'document.upload', 'document.sign', 'document.view',
    'lot.view',
    'offer.create', 'offer.accept',
    'dispute.create', 'dispute.evidence.upload',
    'shipment.view',
    'money.reserve.request',
  ]),
  [Role.LOGISTICIAN]: new Set([
    'deal.view',
    'shipment.create', 'shipment.transition', 'shipment.view', 'shipment.checkpoint',
    'document.upload', 'document.view',
  ]),
  // Driver: own shipment only (enforced at object level)
  [Role.DRIVER]: new Set([
    'shipment.view',
    'shipment.checkpoint',
    'shipment.verify_pin',
    'shipment.transition',
    'document.view',
  ]),
  [Role.LAB]: new Set([
    'lab.sample.create', 'lab.sample.collect', 'lab.test.record', 'lab.protocol.finalize',
    'deal.view',
    'document.upload', 'document.view',
    'shipment.view',
  ]),
  [Role.ELEVATOR]: new Set([
    'deal.view',
    'shipment.view',
    'document.view', 'document.upload',
  ]),
  [Role.ACCOUNTING]: new Set([
    'deal.view',
    'money.reserve.request', 'money.release.request', 'money.adjust',
    'document.view',
  ]),
  [Role.GUEST]: new Set([
    'lot.view',
  ]),
};
