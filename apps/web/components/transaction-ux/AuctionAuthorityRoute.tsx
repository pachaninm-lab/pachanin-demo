import Link from 'next/link';
import { InlineNotice, StatusChip } from '@pc/design-system-v8';
import {
  OperationalCockpitSection,
  OperationalDecisionCockpit,
  OperationalQueue,
  OperationalQueueLink,
  operationalCockpitClasses,
  type OperationalCockpitLabels,
  type OperationalTone,
} from './OperationalDecisionCockpit';

export type AuctionAuthorityAction = {
  href: string;
  label: string;
};

export type AuctionAuthorityStep = {
  href: string;
  title: string;
  detail: string;
  status: string;
  tone: OperationalTone;
};

export type AuctionAuthorityInvariant = {
  title: string;
  detail: string;
  tone: OperationalTone;
};

export type AuctionAuthorityRouteProps = {
  testId: string;
  eyebrow: string;
  title: string;
  description: string;
  statusLabel: string;
  statusTone?: OperationalTone;
  priority: {
    title: string;
    description: string;
    blocker: string;
    owner: string;
    impact: string;
    result: string;
  };
  facts: Array<{ label: string; value: string; hint: string }>;
  boundary: string;
  notice: { title: string; body: string; tone?: OperationalTone };
  primaryAction: AuctionAuthorityAction;
  secondaryAction: AuctionAuthorityAction;
  stepsHeading: string;
  invariantsHeading: string;
  steps: AuctionAuthorityStep[];
  invariants: AuctionAuthorityInvariant[];
  labels: OperationalCockpitLabels;
};

export function AuctionAuthorityRoute({
  testId,
  eyebrow,
  title,
  description,
  statusLabel,
  statusTone = 'warning',
  priority,
  facts,
  boundary,
  notice,
  primaryAction,
  secondaryAction,
  stepsHeading,
  invariantsHeading,
  steps,
  invariants,
  labels,
}: AuctionAuthorityRouteProps) {
  return (
    <OperationalDecisionCockpit
      testId={testId}
      eyebrow={eyebrow}
      title={title}
      description={description}
      statusLabel={statusLabel}
      statusTone={statusTone}
      labels={labels}
      priority={{
        state: 'active',
        title: priority.title,
        description: priority.description,
        blocker: priority.blocker,
        owner: priority.owner,
        impact: priority.impact,
        result: priority.result,
        primaryAction: (
          <Link className={operationalCockpitClasses.primaryLink} href={primaryAction.href}>
            {primaryAction.label}
          </Link>
        ),
        secondaryAction: (
          <Link className={operationalCockpitClasses.secondaryLink} href={secondaryAction.href}>
            {secondaryAction.label}
          </Link>
        ),
      }}
      facts={facts}
      boundary={boundary}
    >
      <OperationalCockpitSection id='auction-route-notice'>
        <InlineNotice tone={notice.tone ?? 'information'} title={notice.title}>{notice.body}</InlineNotice>
      </OperationalCockpitSection>

      <OperationalCockpitSection id='auction-route-steps'>
        <InlineNotice tone='neutral' title={stepsHeading} />
        <OperationalQueue>
          {steps.map((step) => (
            <OperationalQueueLink
              key={step.href}
              href={step.href}
              title={step.title}
              detail={step.detail}
              status={<StatusChip tone={step.tone}>{step.status}</StatusChip>}
            />
          ))}
        </OperationalQueue>
      </OperationalCockpitSection>

      <OperationalCockpitSection id='auction-route-invariants'>
        <InlineNotice tone='neutral' title={invariantsHeading} />
        {invariants.map((invariant) => (
          <InlineNotice key={invariant.title} tone={invariant.tone} title={invariant.title}>
            {invariant.detail}
          </InlineNotice>
        ))}
      </OperationalCockpitSection>
    </OperationalDecisionCockpit>
  );
}
