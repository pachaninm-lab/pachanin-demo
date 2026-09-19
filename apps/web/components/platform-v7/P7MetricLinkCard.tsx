import Link from 'next/link';
import type { ReactNode } from 'react';
import { P7MetricCard } from './P7MetricCard';
import { PLATFORM_V7_TOKENS, type PlatformV7Tone } from '@/lib/platform-v7/design/tokens';

export interface P7MetricLinkCardProps {
  readonly href: string;
  readonly title: ReactNode;
  readonly value: ReactNode;
  readonly note?: ReactNode;
  readonly formula?: string;
  readonly tone?: PlatformV7Tone;
  readonly testId?: string;
}

export function P7MetricLinkCard({ href, title, value, note, formula, tone = 'neutral', testId }: P7MetricLinkCardProps) {
  return (
    <Link href={href} title={formula} data-testid={testId} style={{ color: 'inherit', textDecoration: 'none', display: 'block' }}>
      <P7MetricCard
        title={title}
        value={value}
        note={note}
        tone={tone}
        footer={<span style={{ color: PLATFORM_V7_TOKENS.color.brand, fontSize: 11, fontWeight: 800 }}>Открыть →</span>}
      />
    </Link>
  );
}
