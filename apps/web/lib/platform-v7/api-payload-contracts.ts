import type { PlatformV7ApiBoundaryId } from './api-boundary-contracts';

export type PlatformV7PayloadFieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'iso_datetime'
  | 'money_minor'
  | 'array'
  | 'object';

export type PlatformV7ApiPayloadFieldContract = {
  readonly name: string;
  readonly type: PlatformV7PayloadFieldType;
  readonly required: boolean;
  readonly sensitive: boolean;
  readonly summary: string;
};

export type PlatformV7ApiPayloadContract = {
  readonly boundaryId: PlatformV7ApiBoundaryId;
  readonly requiredFields: readonly PlatformV7ApiPayloadFieldContract[];
  readonly optionalFields: readonly PlatformV7ApiPayloadFieldContract[];
  readonly rejectsEmptyPayload: boolean;
  readonly requiresEvidenceReference: boolean;
  readonly requiresMoneyAmount: boolean;
  readonly requiresExternalReference: boolean;
  readonly summary: string;
};

const required = (
  name: string,
  type: PlatformV7PayloadFieldType,
  summary: string,
  sensitive = false,
): PlatformV7ApiPayloadFieldContract => ({ name, type, required: true, sensitive, summary });

const optional = (
  name: string,
  type: PlatformV7PayloadFieldType,
  summary: string,
  sensitive = false,
): PlatformV7ApiPayloadFieldContract => ({ name, type, required: false, sensitive, summary });

export const PLATFORM_V7_API_PAYLOAD_CONTRACTS: readonly PlatformV7ApiPayloadContract[] = [
  {
    boundaryId: 'create_batch',
    requiredFields: [
      required('crop', 'string', 'Crop name or commodity type.'),
      required('className', 'string', 'Grain class or quality segment.'),
      required('volumeTons', 'number', 'Available physical volume in tons.'),
      required('storageLocation', 'string', 'Storage or pickup location.'),
    ],
    optionalFields: [optional('qualitySnapshot', 'object', 'Quality parameters provided by seller.')],
    rejectsEmptyPayload: true,
    requiresEvidenceReference: false,
    requiresMoneyAmount: false,
    requiresExternalReference: false,
    summary: 'Batch creation must describe the physical grain before market or deal actions.',
  },
  {
    boundaryId: 'publish_lot',
    requiredFields: [
      required('lotId', 'string', 'Lot being published.'),
      required('batchId', 'string', 'Physical batch backing the lot.'),
      required('priceRubPerTon', 'number', 'Seller price basis.'),
      required('basis', 'string', 'Delivery or pickup basis.'),
    ],
    optionalFields: [optional('expiresAt', 'iso_datetime', 'Market visibility deadline.')],
    rejectsEmptyPayload: true,
    requiresEvidenceReference: false,
    requiresMoneyAmount: false,
    requiresExternalReference: false,
    summary: 'Lot publication requires batch link, price and basis.',
  },
  {
    boundaryId: 'create_rfq',
    requiredFields: [
      required('crop', 'string', 'Required crop.'),
      required('volumeTons', 'number', 'Required volume.'),
      required('deliveryRegion', 'string', 'Delivery or purchase region.'),
      required('qualityRequirements', 'object', 'Buyer quality requirements.'),
    ],
    optionalFields: [optional('maxPriceRubPerTon', 'number', 'Buyer target price ceiling.')],
    rejectsEmptyPayload: true,
    requiresEvidenceReference: false,
    requiresMoneyAmount: false,
    requiresExternalReference: false,
    summary: 'RFQ must define demand, not just a generic interest signal.',
  },
  {
    boundaryId: 'submit_proposal',
    requiredFields: [
      required('counterpartyId', 'string', 'Counterparty receiving the proposal.'),
      required('priceRubPerTon', 'number', 'Commercial price.'),
      required('volumeTons', 'number', 'Offered or requested volume.'),
      required('validUntil', 'iso_datetime', 'Proposal expiry time.'),
    ],
    optionalFields: [optional('paymentTerms', 'string', 'Payment conditions for the proposal.')],
    rejectsEmptyPayload: true,
    requiresEvidenceReference: false,
    requiresMoneyAmount: false,
    requiresExternalReference: false,
    summary: 'Proposal must carry commercial terms and a counterparty boundary.',
  },
  {
    boundaryId: 'accept_proposal',
    requiredFields: [required('proposalId', 'string', 'Accepted proposal identifier.'), required('acceptedAt', 'iso_datetime', 'Acceptance timestamp.')],
    optionalFields: [optional('comment', 'string', 'Optional acceptance note.')],
    rejectsEmptyPayload: true,
    requiresEvidenceReference: false,
    requiresMoneyAmount: false,
    requiresExternalReference: false,
    summary: 'Proposal acceptance must identify the proposal and time of acceptance.',
  },
  {
    boundaryId: 'confirm_deal_terms',
    requiredFields: [
      required('dealId', 'string', 'Deal container.'),
      required('sellerAccepted', 'boolean', 'Seller confirms deal terms.'),
      required('buyerAccepted', 'boolean', 'Buyer confirms deal terms.'),
      required('termsVersion', 'string', 'Version of deal terms being confirmed.'),
    ],
    optionalFields: [optional('comment', 'string', 'Optional terms clarification.')],
    rejectsEmptyPayload: true,
    requiresEvidenceReference: false,
    requiresMoneyAmount: false,
    requiresExternalReference: false,
    summary: 'Deal terms require explicit side acceptance and version boundary.',
  },
  {
    boundaryId: 'request_money_reserve',
    requiredFields: [
      required('dealId', 'string', 'Deal that requires reserve.'),
      required('amountMinor', 'money_minor', 'Requested reserve amount in minor currency units.', true),
      required('currency', 'string', 'Reserve currency.'),
      required('reason', 'string', 'Reason for reserve request.'),
    ],
    optionalFields: [optional('bankAccountRef', 'string', 'Payment account reference.', true)],
    rejectsEmptyPayload: true,
    requiresEvidenceReference: false,
    requiresMoneyAmount: true,
    requiresExternalReference: false,
    summary: 'Money reserve request must be amount-bound and deal-bound.',
  },
  {
    boundaryId: 'confirm_money_reserved',
    requiredFields: [
      required('dealId', 'string', 'Deal with reserved money.'),
      required('amountMinor', 'money_minor', 'Confirmed reserved amount.', true),
      required('currency', 'string', 'Confirmed currency.'),
      required('bankReferenceId', 'string', 'External bank reference.', true),
      required('confirmedAt', 'iso_datetime', 'Bank confirmation timestamp.'),
    ],
    optionalFields: [optional('bankStatusPayload', 'object', 'Raw or normalized bank status payload.', true)],
    rejectsEmptyPayload: true,
    requiresEvidenceReference: false,
    requiresMoneyAmount: true,
    requiresExternalReference: true,
    summary: 'Reserved money state requires bank reference and amount confirmation.',
  },
  {
    boundaryId: 'mark_money_ready_to_release',
    requiredFields: [
      required('dealId', 'string', 'Deal being reviewed for money release.'),
      required('amountMinor', 'money_minor', 'Amount proposed for release.', true),
      required('documentPackId', 'string', 'Document pack supporting release.'),
      required('acceptanceEventId', 'string', 'Acceptance evidence event.'),
    ],
    optionalFields: [optional('comment', 'string', 'Operator or bank review note.')],
    rejectsEmptyPayload: true,
    requiresEvidenceReference: true,
    requiresMoneyAmount: true,
    requiresExternalReference: false,
    summary: 'Ready-to-release requires evidence and amount; it is not a release confirmation.',
  },
  {
    boundaryId: 'confirm_money_released',
    requiredFields: [
      required('dealId', 'string', 'Deal with released money.'),
      required('amountMinor', 'money_minor', 'Released amount.', true),
      required('currency', 'string', 'Released currency.'),
      required('bankReferenceId', 'string', 'External bank release reference.', true),
      required('confirmedAt', 'iso_datetime', 'Bank release confirmation timestamp.'),
    ],
    optionalFields: [optional('bankStatusPayload', 'object', 'Raw or normalized bank release payload.', true)],
    rejectsEmptyPayload: true,
    requiresEvidenceReference: false,
    requiresMoneyAmount: true,
    requiresExternalReference: true,
    summary: 'Money release confirmation must come with a bank reference; platform records the boundary only.',
  },
  {
    boundaryId: 'upload_document',
    requiredFields: [
      required('dealId', 'string', 'Deal linked to the document.'),
      required('documentType', 'string', 'Type of uploaded document.'),
      required('fileRef', 'string', 'Stored file reference.', true),
      required('uploadedAt', 'iso_datetime', 'Upload timestamp.'),
    ],
    optionalFields: [optional('externalDocumentId', 'string', 'External document system reference.', true)],
    rejectsEmptyPayload: true,
    requiresEvidenceReference: true,
    requiresMoneyAmount: false,
    requiresExternalReference: false,
    summary: 'Uploaded document is evidence, not an accepted or externally confirmed document.',
  },
  {
    boundaryId: 'accept_document',
    requiredFields: [
      required('dealId', 'string', 'Deal linked to the document.'),
      required('documentId', 'string', 'Accepted document.'),
      required('reviewedBy', 'string', 'Reviewer actor identifier.'),
      required('reviewedAt', 'iso_datetime', 'Review timestamp.'),
    ],
    optionalFields: [optional('externalConfirmationRef', 'string', 'External confirmation reference.', true)],
    rejectsEmptyPayload: true,
    requiresEvidenceReference: true,
    requiresMoneyAmount: false,
    requiresExternalReference: true,
    summary: 'Document acceptance must show reviewer and external confirmation boundary if money can be affected.',
  },
  {
    boundaryId: 'assign_driver',
    requiredFields: [
      required('dealId', 'string', 'Deal linked to trip.'),
      required('tripId', 'string', 'Trip being assigned.'),
      required('driverId', 'string', 'Assigned driver.'),
      required('vehicleId', 'string', 'Assigned vehicle.'),
    ],
    optionalFields: [optional('routeInstruction', 'string', 'Driver route instruction.')],
    rejectsEmptyPayload: true,
    requiresEvidenceReference: false,
    requiresMoneyAmount: false,
    requiresExternalReference: false,
    summary: 'Driver assignment must identify trip, driver and vehicle.',
  },
  {
    boundaryId: 'mark_trip_arrived',
    requiredFields: [
      required('dealId', 'string', 'Deal linked to trip.'),
      required('tripId', 'string', 'Arrived trip.'),
      required('arrivedAt', 'iso_datetime', 'Arrival timestamp.'),
      required('geoPoint', 'object', 'Arrival geolocation evidence.'),
    ],
    optionalFields: [optional('photoRefs', 'array', 'Arrival photo evidence references.', true)],
    rejectsEmptyPayload: true,
    requiresEvidenceReference: true,
    requiresMoneyAmount: false,
    requiresExternalReference: false,
    summary: 'Driver arrival must create time and location evidence.',
  },
  {
    boundaryId: 'accept_trip',
    requiredFields: [
      required('dealId', 'string', 'Deal linked to trip.'),
      required('tripId', 'string', 'Accepted trip.'),
      required('acceptedAt', 'iso_datetime', 'Acceptance timestamp.'),
      required('weightTons', 'number', 'Accepted weight.'),
      required('acceptanceEventId', 'string', 'Acceptance evidence event.'),
    ],
    optionalFields: [optional('qualitySnapshot', 'object', 'Quality result used in acceptance.')],
    rejectsEmptyPayload: true,
    requiresEvidenceReference: true,
    requiresMoneyAmount: false,
    requiresExternalReference: false,
    summary: 'Trip acceptance requires weight and evidence because it can affect money.',
  },
  {
    boundaryId: 'open_incident',
    requiredFields: [
      required('dealId', 'string', 'Deal linked to incident.'),
      required('tripId', 'string', 'Trip linked to incident.'),
      required('reason', 'string', 'Incident reason.'),
      required('evidenceRefs', 'array', 'Evidence references supporting incident.', true),
    ],
    optionalFields: [optional('moneyImpactHint', 'string', 'Potential money impact description.')],
    rejectsEmptyPayload: true,
    requiresEvidenceReference: true,
    requiresMoneyAmount: false,
    requiresExternalReference: false,
    summary: 'Incident cannot be opened as a blank complaint; evidence is required.',
  },
  {
    boundaryId: 'open_dispute',
    requiredFields: [
      required('dealId', 'string', 'Deal linked to dispute.'),
      required('reason', 'string', 'Dispute reason.'),
      required('claimAmountMinor', 'money_minor', 'Claimed money impact.', true),
      required('evidenceRefs', 'array', 'Evidence references supporting dispute.', true),
    ],
    optionalFields: [optional('requestedOutcome', 'string', 'Requested outcome from disputing side.')],
    rejectsEmptyPayload: true,
    requiresEvidenceReference: true,
    requiresMoneyAmount: true,
    requiresExternalReference: false,
    summary: 'Dispute requires reason, evidence and money impact boundary.',
  },
  {
    boundaryId: 'resolve_dispute',
    requiredFields: [
      required('dealId', 'string', 'Deal linked to dispute.'),
      required('disputeId', 'string', 'Resolved dispute.'),
      required('decision', 'string', 'Decision outcome.'),
      required('moneyAction', 'string', 'Money action required by decision.'),
      required('decisionEventId', 'string', 'Audit/evidence event supporting decision.'),
    ],
    optionalFields: [optional('amountMinor', 'money_minor', 'Decision amount if applicable.', true)],
    rejectsEmptyPayload: true,
    requiresEvidenceReference: true,
    requiresMoneyAmount: false,
    requiresExternalReference: false,
    summary: 'Dispute resolution must carry decision and money action, not just a status flip.',
  },
  {
    boundaryId: 'create_support_case',
    requiredFields: [
      required('title', 'string', 'Support case title.'),
      required('category', 'string', 'Execution category.'),
      required('priority', 'string', 'Priority tied to money, documents, logistics or dispute risk.'),
      required('description', 'string', 'Case description.'),
    ],
    optionalFields: [optional('relatedEntityId', 'string', 'Deal, trip, document, dispute or support-related entity.')],
    rejectsEmptyPayload: true,
    requiresEvidenceReference: false,
    requiresMoneyAmount: false,
    requiresExternalReference: false,
    summary: 'Support case must stay linked to execution context, not generic chat.',
  },
  {
    boundaryId: 'append_support_message',
    requiredFields: [required('caseId', 'string', 'Support case.'), required('message', 'string', 'Message body.'), required('sentAt', 'iso_datetime', 'Message timestamp.')],
    optionalFields: [optional('attachmentRefs', 'array', 'Support attachment references.', true)],
    rejectsEmptyPayload: true,
    requiresEvidenceReference: false,
    requiresMoneyAmount: false,
    requiresExternalReference: false,
    summary: 'Support message must be attached to a case and timestamped.',
  },
];

export function getPlatformV7ApiPayloadContract(boundaryId: PlatformV7ApiBoundaryId) {
  return PLATFORM_V7_API_PAYLOAD_CONTRACTS.find((contract) => contract.boundaryId === boundaryId);
}

export function getPlatformV7RequiredPayloadFieldNames(boundaryId: PlatformV7ApiBoundaryId) {
  return getPlatformV7ApiPayloadContract(boundaryId)?.requiredFields.map((field) => field.name) ?? [];
}

export function getPlatformV7PayloadContractsRequiringMoneyAmount() {
  return PLATFORM_V7_API_PAYLOAD_CONTRACTS.filter((contract) => contract.requiresMoneyAmount);
}

export function getPlatformV7PayloadContractsRequiringEvidence() {
  return PLATFORM_V7_API_PAYLOAD_CONTRACTS.filter((contract) => contract.requiresEvidenceReference);
}

export function getPlatformV7PayloadContractsRequiringExternalReference() {
  return PLATFORM_V7_API_PAYLOAD_CONTRACTS.filter((contract) => contract.requiresExternalReference);
}

export function getPlatformV7ApiPayloadReadinessSummary() {
  return {
    total: PLATFORM_V7_API_PAYLOAD_CONTRACTS.length,
    rejectingEmptyPayload: PLATFORM_V7_API_PAYLOAD_CONTRACTS.filter((contract) => contract.rejectsEmptyPayload).length,
    requiringEvidence: getPlatformV7PayloadContractsRequiringEvidence().length,
    requiringMoneyAmount: getPlatformV7PayloadContractsRequiringMoneyAmount().length,
    requiringExternalReference: getPlatformV7PayloadContractsRequiringExternalReference().length,
    mode: 'contract_only_requires_validation_runtime' as const,
  };
}
