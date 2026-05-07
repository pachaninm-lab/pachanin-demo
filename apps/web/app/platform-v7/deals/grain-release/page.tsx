import { GrainActionFeedbackPanel } from '@/components/platform-v7/GrainActionFeedbackPanel';
import { GrainExecutionPage } from '@/components/platform-v7/GrainExecutionPage';

export default function PlatformV7DealReleasePage() {
  return (
    <>
      <GrainExecutionPage mode='deal-release' role='bank' />
      <GrainActionFeedbackPanel />
    </>
  );
}
