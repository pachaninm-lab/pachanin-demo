'use client';

import dynamic from 'next/dynamic';
import { SingleServerPublicSpacing } from '@/components/platform-v7/SingleServerPublicSpacing';

const ChatSupportWidget = dynamic(
  () => import('@/components/platform-v7/ChatSupportWidget').then((module) => module.ChatSupportWidget),
  { ssr: false, loading: () => null },
);

const SingleServerPublicDock = dynamic(
  () => import('@/components/platform-v7/SingleServerPublicDock').then((module) => module.SingleServerPublicDock),
  { ssr: false, loading: () => null },
);

/**
 * The single-server production line keeps its proven runtime and mounts only the
 * browser interaction surfaces required by the public experience. The support
 * form remains unchanged; the unified dock becomes its only visible trigger.
 */
export function HydrationSafeChatSupport() {
  return (
    <>
      <ChatSupportWidget />
      <SingleServerPublicDock />
      <SingleServerPublicSpacing />
    </>
  );
}
