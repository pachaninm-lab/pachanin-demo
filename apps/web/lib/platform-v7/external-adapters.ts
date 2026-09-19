export type PlatformV7AdapterProvider = 'mock' | 'real';
export type PlatformV7AdapterStatus = 'available' | 'degraded' | 'unavailable';

export interface PlatformV7AdapterHealth {
  readonly provider: PlatformV7AdapterProvider;
  readonly system: PlatformV7ExternalSystem;
  readonly status: PlatformV7AdapterStatus;
  readonly checkedAt: string;
  readonly message?: string;
}

export interface PlatformV7ExternalAdapter<TRequest, TResponse> {
  readonly provider: PlatformV7AdapterProvider;
  readonly system: PlatformV7ExternalSystem;
  call(request: TRequest): Promise<TResponse>;
  healthCheck(): Promise<PlatformV7AdapterHealth>;
}

export type PlatformV7ExternalSystem = 'bank' | 'fgis' | 'edo' | 'epd' | 'logistics' | 'lab' | 'oneC' | 'notification';

export interface PlatformV7ExternalCallContext {
  readonly correlationId: string;
  readonly auditId: string;
  readonly actorId: string;
  readonly organizationId: string;
  readonly role: string;
  readonly idempotencyKey?: string;
}

export interface PlatformV7ExternalCallResult<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  readonly externalCallId: string;
  readonly provider: PlatformV7AdapterProvider;
  readonly system: PlatformV7ExternalSystem;
  readonly status: 'accepted' | 'pending' | 'manual_review' | 'failed';
  readonly payload: TPayload;
  readonly correlationId: string;
  readonly auditId: string;
  readonly doesNotConfirmExternally: true;
}

export interface PlatformV7BankRequest {
  readonly operation: 'createBeneficiary' | 'requestReserve' | 'requestHold' | 'requestRelease' | 'requestRefund' | 'getReconciliationStatus';
  readonly dealId: string;
  readonly amount?: number;
  readonly currency?: 'RUB';
  readonly context: PlatformV7ExternalCallContext;
}

export interface PlatformV7FgisRequest {
  readonly operation: 'createGrainBatchDraft' | 'getGrainBatchStatus' | 'createSdizDraft' | 'sendSdiz' | 'getSdizStatus' | 'redeemSdiz' | 'handleFgisError';
  readonly partyId?: string;
  readonly sdizId?: string;
  readonly context: PlatformV7ExternalCallContext;
}

export interface PlatformV7DocumentExchangeRequest {
  readonly operation: 'createDocumentPackage' | 'sendForSignature' | 'getSignatureStatus' | 'rejectDocument' | 'confirmDocument' | 'downloadSignedDocument';
  readonly dealId: string;
  readonly documentIds: readonly string[];
  readonly context: PlatformV7ExternalCallContext;
}

export interface PlatformV7TransportDocumentRequest {
  readonly operation: 'createTransportDocument' | 'sendTransportDocument' | 'getTransportDocumentStatus' | 'signByCarrier' | 'signByConsignor' | 'signByConsignee' | 'handleTransportDocumentError';
  readonly tripId: string;
  readonly documentId?: string;
  readonly context: PlatformV7ExternalCallContext;
}

export interface PlatformV7LogisticsAdapterRequest {
  readonly operation: 'createRoute' | 'assignVehicle' | 'assignDriver' | 'receiveGpsPoint' | 'receiveGeofenceEvent' | 'receiveEtaUpdate' | 'receiveDeviationAlert';
  readonly tripId: string;
  readonly context: PlatformV7ExternalCallContext;
}

export interface PlatformV7LabAdapterRequest {
  readonly operation: 'createSample' | 'submitProtocol' | 'getProtocolStatus' | 'confirmProtocol' | 'rejectProtocol';
  readonly sampleId?: string;
  readonly protocolId?: string;
  readonly context: PlatformV7ExternalCallContext;
}

export interface PlatformV7OneCAdapterRequest {
  readonly operation: 'exportDeal' | 'exportDocuments' | 'exportMoneyOperation' | 'exportCounterparty' | 'getExportStatus';
  readonly entityId: string;
  readonly context: PlatformV7ExternalCallContext;
}

export type PlatformV7AdapterRequestBySystem = {
  readonly bank: PlatformV7BankRequest;
  readonly fgis: PlatformV7FgisRequest;
  readonly edo: PlatformV7DocumentExchangeRequest;
  readonly epd: PlatformV7TransportDocumentRequest;
  readonly logistics: PlatformV7LogisticsAdapterRequest;
  readonly lab: PlatformV7LabAdapterRequest;
  readonly oneC: PlatformV7OneCAdapterRequest;
  readonly notification: { readonly operation: 'send'; readonly context: PlatformV7ExternalCallContext };
};

export type PlatformV7AdapterRegistry = {
  readonly [System in PlatformV7ExternalSystem]: PlatformV7ExternalAdapter<
    PlatformV7AdapterRequestBySystem[System],
    PlatformV7ExternalCallResult
  >;
};

export function platformV7CreateMockAdapter<System extends PlatformV7ExternalSystem>(system: System): PlatformV7ExternalAdapter<PlatformV7AdapterRequestBySystem[System], PlatformV7ExternalCallResult> {
  return {
    provider: 'mock',
    system,
    async call(request) {
      return {
        externalCallId: `${system}-${request.context.correlationId}`,
        provider: 'mock',
        system,
        status: 'pending',
        payload: { operation: request.operation },
        correlationId: request.context.correlationId,
        auditId: request.context.auditId,
        doesNotConfirmExternally: true,
      };
    },
    async healthCheck() {
      return {
        provider: 'mock',
        system,
        status: 'available',
        checkedAt: new Date(0).toISOString(),
        message: 'Mock adapter contract is available for controlled internal flows.',
      };
    },
  };
}

export function platformV7CreateMockAdapterRegistry(): PlatformV7AdapterRegistry {
  return {
    bank: platformV7CreateMockAdapter('bank'),
    fgis: platformV7CreateMockAdapter('fgis'),
    edo: platformV7CreateMockAdapter('edo'),
    epd: platformV7CreateMockAdapter('epd'),
    logistics: platformV7CreateMockAdapter('logistics'),
    lab: platformV7CreateMockAdapter('lab'),
    oneC: platformV7CreateMockAdapter('oneC'),
    notification: platformV7CreateMockAdapter('notification'),
  };
}
