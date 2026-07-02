'use client';

import * as Tooltip from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';

interface Props {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  delayMs?: number;
}

export function PlatformTooltip({ content, children, side = 'top', align = 'center', delayMs = 400 }: Props) {
  return (
    <Tooltip.Provider delayDuration={delayMs}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side={side}
            align={align}
            sideOffset={6}
            style={{
              background: '#0F1419',
              color: '#F8FAFC',
              fontSize: 11,
              fontWeight: 600,
              lineHeight: 1.5,
              padding: '6px 10px',
              borderRadius: 8,
              maxWidth: 260,
              zIndex: 1000,
              boxShadow: '0 8px 24px rgba(0,0,0,0.22)',
              animation: 'tooltipFadeIn 120ms ease',
            }}
          >
            {content}
            <Tooltip.Arrow style={{ fill: '#0F1419' }} />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
      <style>{`@keyframes tooltipFadeIn { from { opacity: 0; transform: translateY(2px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </Tooltip.Provider>
  );
}
