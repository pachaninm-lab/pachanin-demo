import {
  ConnectionKind,
  MissingPrerequisite,
  describeConnection,
} from './connection-center.policy';
import { IntegrationCapabilityMaturity } from '../../../../../packages/domain-core/src';

/**
 * What the platform may claim about a connection.
 *
 * Every case here is a way somebody could end up with a green tick they did not
 * earn, which is the only failure mode this module has: it writes nothing, so
 * the sole thing it can get wrong is telling a person a connection works.
 */

const nothing = {
  kind: ConnectionKind.ONE_C,
  adapterImplemented: false,
  endpointConfigured: false,
  credentialIssued: false,
  contractAttested: false,
  testExchangeRecorded: false,
  liveReceiptExternalId: null,
};

const everything = {
  kind: ConnectionKind.EDO,
  adapterImplemented: true,
  endpointConfigured: true,
  credentialIssued: true,
  contractAttested: true,
  testExchangeRecorded: true,
  liveReceiptExternalId: 'edo-4711',
};

describe('what a connection may be called', () => {
  it('starts at NOT_ATTESTED and says so rather than staying silent', () => {
    const state = describeConnection(nothing);
    expect(state.maturity).toBe(IntegrationCapabilityMaturity.DISCOVERED);
    expect(state.mayCarryRealTraffic).toBe(false);
    expect(state.missing).toContain(MissingPrerequisite.ADAPTER_NOT_IMPLEMENTED);
  });

  it('reaches ADAPTER_READY on an attested contract alone', () => {
    // Code that satisfies its contract against a fake. Nothing has spoken to a
    // vendor yet, and the level does not pretend otherwise.
    expect(
      describeConnection({
        ...nothing,
        adapterImplemented: true,
        contractAttested: true,
      }).maturity,
    ).toBe(IntegrationCapabilityMaturity.ADAPTER_IMPLEMENTED);
  });

  it('reaches TEST only once the vendor answered', () => {
    expect(
      describeConnection({ ...everything, liveReceiptExternalId: null }).maturity,
    ).toBe(IntegrationCapabilityMaturity.LIVE_TESTING);
  });

  it('reaches LIVE_ACCEPTED only with a receipt carrying the far side’s id', () => {
    expect(describeConnection(everything).maturity).toBe(
      IntegrationCapabilityMaturity.LIVE_ACCEPTED,
    );
    expect(describeConnection(everything).mayCarryRealTraffic).toBe(true);
  });

  it('refuses to call it live when a rung below is missing', () => {
    // A receipt without an attested contract means real traffic went through an
    // adapter nobody checked. That is a finding, not a level.
    const state = describeConnection({ ...everything, contractAttested: false });
    expect(state.maturity).not.toBe(IntegrationCapabilityMaturity.LIVE_ACCEPTED);
    expect(state.missing).toContain(MissingPrerequisite.CONTRACT_NOT_ATTESTED);
  });

  it('refuses to call it live on credentials nobody issued', () => {
    expect(
      describeConnection({ ...everything, credentialIssued: false }).maturity,
    ).not.toBe(IntegrationCapabilityMaturity.LIVE_ACCEPTED);
  });

  it('names every prerequisite still outstanding, not only the first', () => {
    // Discovering blockers one per attempt turns one afternoon into four.
    expect(describeConnection(nothing).missing).toEqual([
      MissingPrerequisite.ADAPTER_NOT_IMPLEMENTED,
      MissingPrerequisite.ENDPOINT_NOT_CONFIGURED,
      MissingPrerequisite.VENDOR_CREDENTIALS_NOT_ISSUED,
      MissingPrerequisite.CONTRACT_NOT_ATTESTED,
      MissingPrerequisite.TEST_EXCHANGE_NOT_PERFORMED,
      MissingPrerequisite.LIVE_RECEIPT_NOT_OBTAINED,
    ]);
  });

  it('leaves nothing outstanding once it is live', () => {
    expect(describeConnection(everything).missing).toEqual([]);
  });

  it('treats an empty receipt id as no receipt', () => {
    // The distinction the whole ladder rests on: a send that did not error is
    // not a receipt, and a receipt without the far side's identifier is not one
    // either.
    expect(
      describeConnection({ ...everything, liveReceiptExternalId: null }).missing,
    ).toContain(MissingPrerequisite.LIVE_RECEIPT_NOT_OBTAINED);
  });
});
