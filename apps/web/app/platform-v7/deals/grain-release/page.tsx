import { GrainActionFeedbackPanel } from '@/components/platform-v7/GrainActionFeedbackPanel';
import { GrainReleaseCockpit } from '@/components/platform-v7/GrainReleaseCockpit';

export default function PlatformV7DealReleasePage() {
  return (
    <>
      <GrainReleaseCockpit role='bank' />
      <GrainActionFeedbackPanel role='bank' />
    </>
  );
}
