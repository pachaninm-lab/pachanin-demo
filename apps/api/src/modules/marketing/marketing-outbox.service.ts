import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { OutboxEntry } from '../../common/outbox/outbox.service';
import { MarketingPolicyService } from './marketing-policy.service';
import {
  MarketingPublicationAdmissionService,
  type MarketingPublicationAdmissionCommand,
} from './marketing-publication-admission';

const MAX_IDEMPOTENCY_KEY_LENGTH = 200;

@Injectable()
export class MarketingOutboxService {
  constructor(
    private readonly policy: MarketingPolicyService,
    private readonly admission: MarketingPublicationAdmissionService,
  ) {}

  async enqueue(request: MarketingPublicationAdmissionCommand): Promise<OutboxEntry> {
    const idempotencyKey = request.idempotencyKey.trim();
    if (!idempotencyKey || idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
      throw new ServiceUnavailableException(
        `Marketing idempotency key must contain 1-${MAX_IDEMPOTENCY_KEY_LENGTH} characters.`,
      );
    }

    // Prevent knowingly non-compliant commands from reserving a cadence slot.
    // The worker repeats the live policy immediately before connector dispatch.
    this.policy.assertAllowed({
      ...request.policy,
      channel: request.channel,
      text: request.text,
    });

    const admitted = await this.admission.admitAndEnqueue(request);
    return admitted.entry as OutboxEntry;
  }
}
