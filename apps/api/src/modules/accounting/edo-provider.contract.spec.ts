import {
  EDO_DOCUMENT_STATES,
  EDO_PROVIDER_ADAPTER_METHODS,
  EDO_ROUTES,
  EdoDocumentState,
  EdoProviderContractError,
  EdoRoute,
  edoStateAfterSendFailure,
  hasDuplicateAutomaticEdoChannel,
  isEdoDocumentState,
  isEdoRoute,
  requiresEdoReconciliationBeforeRetry,
  validateDiadocBinding,
  validateSabyBinding,
} from './edo-provider.contract';

describe('provider-neutral EDO contract', () => {
  it('pins the exact five EDO routes from the execution contract', () => {
    expect(EDO_ROUTES).toEqual([
      'ONE_C_EDO',
      'DIRECT_DIADOC',
      'DIRECT_SABY',
      'OTHER_ADAPTER',
      'MANUAL',
    ]);
  });

  it('pins the exact provider-neutral document states', () => {
    expect(EDO_DOCUMENT_STATES).toEqual([
      'DRAFT',
      'READY_TO_SIGN',
      'SIGNED',
      'SUBMITTED',
      'DELIVERED',
      'COUNTERPARTY_ACTION_REQUIRED',
      'ACCEPTED',
      'REJECTED',
      'CORRECTION_REQUIRED',
      'ANNULMENT_PENDING',
      'ANNULLED',
      'ERROR',
      'UNKNOWN',
    ]);
  });

  it('pins the exact provider adapter surface', () => {
    expect(EDO_PROVIDER_ADAPTER_METHODS).toEqual([
      'connect',
      'disconnect',
      'health',
      'listOrganizations',
      'resolveCounterparty',
      'checkRoute',
      'createDraft',
      'validate',
      'send',
      'getDocument',
      'getStatus',
      'accept',
      'reject',
      'requestCorrection',
      'annul',
      'getEvents',
      'downloadOriginal',
      'downloadSignatures',
      'downloadServiceDocuments',
    ]);
  });

  it('refuses unknown route and state vocabulary', () => {
    expect(isEdoRoute('DIRECT_UNKNOWN')).toBe(false);
    expect(isEdoDocumentState('SENT_OK')).toBe(false);
  });

  it('binds Diadoc to one explicitly selected authorized box', () => {
    expect(() =>
      validateDiadocBinding(
        {
          platformOrganizationId: 'platform-org-a',
          providerOrganizationId: 'diadoc-org-a',
          providerBoxId: 'box-a',
        },
        ['box-a', 'box-b'],
      ),
    ).not.toThrow();
  });

  it('does not let one Diadoc OAuth identity grant another box implicitly', () => {
    expect(() =>
      validateDiadocBinding(
        {
          platformOrganizationId: 'platform-org-a',
          providerOrganizationId: 'diadoc-org-a',
          providerBoxId: 'box-b',
        },
        ['box-a'],
      ),
    ).toThrow('providerBoxId must be explicitly authorized and selected');
  });

  it('refuses a Diadoc binding without the concrete provider box', () => {
    expect(() =>
      validateDiadocBinding(
        {
          platformOrganizationId: 'platform-org-a',
          providerOrganizationId: 'diadoc-org-a',
          providerBoxId: '',
        },
        [],
      ),
    ).toThrow('providerBoxId is required');
  });

  it('binds Saby to a concrete provider organization and account', () => {
    expect(() =>
      validateSabyBinding({
        platformOrganizationId: 'platform-org-a',
        providerOrganizationId: 'saby-org-a',
        providerAccountId: 'saby-account-a',
      }),
    ).not.toThrow();
  });

  it('refuses a Saby binding without a concrete account', () => {
    expect(() =>
      validateSabyBinding({
        platformOrganizationId: 'platform-org-a',
        providerOrganizationId: 'saby-org-a',
        providerAccountId: '',
      }),
    ).toThrow('providerAccountId is required');
  });

  it('marks a second automatic channel as duplicate when 1C-EDO is primary', () => {
    expect(
      hasDuplicateAutomaticEdoChannel({
        primary: EdoRoute.ONE_C_EDO,
        additional: [EdoRoute.DIRECT_DIADOC],
      }),
    ).toBe(true);
    expect(
      hasDuplicateAutomaticEdoChannel({
        primary: EdoRoute.ONE_C_EDO,
        additional: [EdoRoute.DIRECT_SABY, EdoRoute.OTHER_ADAPTER],
      }),
    ).toBe(true);
  });

  it('does not treat MANUAL evidence as a second automatic provider channel', () => {
    expect(
      hasDuplicateAutomaticEdoChannel({
        primary: EdoRoute.ONE_C_EDO,
        additional: [EdoRoute.MANUAL],
      }),
    ).toBe(false);
  });

  it('does not impose a vendor priority when 1C-EDO is not the selected primary route', () => {
    expect(
      hasDuplicateAutomaticEdoChannel({
        primary: EdoRoute.DIRECT_DIADOC,
        additional: [EdoRoute.MANUAL],
      }),
    ).toBe(false);
  });

  it('refuses an unknown additional route instead of ignoring it', () => {
    expect(() =>
      hasDuplicateAutomaticEdoChannel({
        primary: EdoRoute.ONE_C_EDO,
        additional: ['SHADOW_CHANNEL' as EdoRoute],
      }),
    ).toThrow(EdoProviderContractError);
  });

  it('maps timeout after send to UNKNOWN, never DELIVERED or ACCEPTED', () => {
    expect(edoStateAfterSendFailure('TIMEOUT')).toBe(EdoDocumentState.UNKNOWN);
    expect(edoStateAfterSendFailure('CONNECTION_LOST')).toBe(
      EdoDocumentState.UNKNOWN,
    );
  });

  it('keeps a provider-confirmed error distinct from an ambiguous send result', () => {
    expect(edoStateAfterSendFailure('PROVIDER_CONFIRMED_ERROR')).toBe(
      EdoDocumentState.ERROR,
    );
  });

  it('requires reconciliation before retrying UNKNOWN', () => {
    expect(requiresEdoReconciliationBeforeRetry(EdoDocumentState.UNKNOWN)).toBe(
      true,
    );
    expect(requiresEdoReconciliationBeforeRetry(EdoDocumentState.ERROR)).toBe(
      false,
    );
  });

  it('fails closed when reconciliation policy receives an invented state', () => {
    expect(() =>
      requiresEdoReconciliationBeforeRetry('DELIVERED_OK' as EdoDocumentState),
    ).toThrow('EDO state is unknown');
  });
});
