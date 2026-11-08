import type { GatewayRefusal } from '@pc/ai-assistant-stream-contract';
import type { GatewayStreamStatus } from '@/lib/platform-v7/ai-gateway-stream';

export type GektaCitation = Readonly<{ sourceId: string; title: string; uri: string }>;
export type GektaAttachmentSummary = Readonly<{ name: string; size: number; mediaType: string }>;

export type GektaMessage = Readonly<{
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
  status?: GatewayStreamStatus;
  refusal?: GatewayRefusal | null;
  citations?: readonly GektaCitation[];
  attachments?: readonly GektaAttachmentSummary[];
}>;

export type GektaConversation = Readonly<{
  id: string;
  locale: 'ru' | 'en' | 'zh';
  title: string;
  createdAt: string;
  updatedAt: string;
  /** Null or absent means the conversation sits in the general history. */
  projectId?: string | null;
  messages: readonly GektaMessage[];
}>;
