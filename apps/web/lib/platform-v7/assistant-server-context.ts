import {
  readVerifiedCabinetRole,
  readVerifiedCabinetSessionRole,
} from './verified-session';
import {
  emptyRoutingContext,
  type AssistantConversationTurn,
  type AssistantRoutingContext,
  type AssistantSelectedObjectKind,
} from './assistant-relevance-router';
import type { PlatformKnowledgeLocale, PlatformKnowledgeSectionId } from './assistant-capability-registry';

/**
 * Server-derived context for assistant routing.
 *
 * The reader's role and the page they are standing on are resolved here, from
 * the request itself — a signed session cookie and the referrer — and never from
 * the request body. A browser that claims to be a bank officer on a deal page
 * gets exactly the context an anonymous visitor gets.
 *
 * What is deliberately *not* derived: organization id, tenant id and object id.
 * Routing needs the kind of object in front of the reader, never its identity,
 * and an assistant that never learns an id cannot leak one.
 */

const CABINET_SESSION_COOKIE = 'pc_v7_cabinet';
const ACCESS_TOKEN_COOKIE = 'pc_access';
const PLATFORM_PREFIX = '/platform-v7';

/** Cabinet segments that mean the reader is inside a workspace. */
const CABINET_SEGMENTS: ReadonlySet<string> = new Set([
  'seller', 'buyer', 'logistics', 'driver', 'elevator', 'lab', 'surveyor',
  'bank', 'operator', 'operator-cockpit', 'compliance', 'arbitrator', 'executive', 'investor',
  'deals', 'deal-flow', 'deal-acceptance', 'deal-documents-basis', 'deal-logistics', 'deal-drafts',
  'documents', 'disputes', 'dispute', 'money', 'settlement', 'audit-log', 'analytics', 'reports',
  'auction', 'auctions', 'lot', 'lots', 'profile', 'notifications', 'field', 'trading', 'procurement',
]);

/** Page segments that identify the kind of object a reader is looking at. */
const OBJECT_BY_SEGMENT: Readonly<Record<string, AssistantSelectedObjectKind>> = {
  deals: 'deal',
  'deal-flow': 'deal',
  'deal-acceptance': 'deal',
  'deal-documents-basis': 'deal',
  'deal-logistics': 'deal',
  'deal-drafts': 'deal',
  documents: 'document',
  'grain-documents': 'document',
  'evidence-pack': 'document',
  field: 'field',
  lot: 'lot',
  lots: 'lot',
  'buyer-lot': 'lot',
  batches: 'lot',
  logistics: 'trip',
  'grain-logistics': 'trip',
  driver: 'trip',
  disputes: 'dispute',
  dispute: 'dispute',
  money: 'payment',
  settlement: 'payment',
  'grain-payment': 'payment',
};

export type AssistantContextEnvelope = Readonly<{
  locale: PlatformKnowledgeLocale;
  recentMessages: readonly AssistantConversationTurn[];
  previousTopic: PlatformKnowledgeSectionId | null;
  hasAttachment: boolean;
  semanticHint: 'related' | 'unrelated' | null;
}>;

type CookieReader = Readonly<{ get(name: string): { value: string } | undefined }>;

export type AssistantRequestLike = Readonly<{
  cookies: CookieReader;
  headers: Headers;
}>;

function sessionSecret(env: NodeJS.ProcessEnv): string {
  return (env.JWT_SECRET || env.PC_CABINET_SESSION_SECRET || '').trim();
}

/**
 * Reads the referrer as a page path.
 *
 * Only a same-origin platform path counts. Anything else — another site, a route
 * that is not part of the platform, a malformed value — resolves to null, which
 * is the honest answer: there is no platform surface to reason about.
 */
export function derivePageFromReferer(referer: string | null, siteOrigin: string | null): string | null {
  if (!referer) return null;
  let url: URL;
  try {
    url = new URL(referer, siteOrigin || 'https://placeholder.invalid');
  } catch {
    return null;
  }
  if (siteOrigin) {
    try {
      if (url.origin !== new URL(siteOrigin).origin) return null;
    } catch {
      return null;
    }
  }
  const path = url.pathname;
  if (path !== PLATFORM_PREFIX && !path.startsWith(`${PLATFORM_PREFIX}/`)) return null;
  return path;
}

function segmentOf(page: string | null): string | null {
  if (!page) return null;
  const parts = page.split('/').filter(Boolean);
  return parts[1] ?? null;
}

export function selectedObjectForPage(page: string | null): AssistantSelectedObjectKind | null {
  const segment = segmentOf(page);
  if (!segment) return null;
  return OBJECT_BY_SEGMENT[segment] ?? null;
}

export function isWorkspacePage(page: string | null): boolean {
  const segment = segmentOf(page);
  return segment !== null && CABINET_SEGMENTS.has(segment);
}

/**
 * Resolves the exact cabinet role from the verified session.
 *
 * The role travels onward unchanged — not folded into a coarse class. Folding it
 * before routing is what made role-specific answers disappear: twelve cabinets
 * collapsed into a handful of buckets, and the answer stopped matching the
 * reader long before the model saw it.
 */
export async function readVerifiedRole(
  request: AssistantRequestLike,
  env: NodeJS.ProcessEnv = process.env,
  nowSeconds: number = Math.floor(Date.now() / 1_000),
): Promise<string | null> {
  const secret = sessionSecret(env);
  if (!secret) return null;
  const cabinetToken = request.cookies.get(CABINET_SESSION_COOKIE)?.value ?? null;
  const sessionRole = await readVerifiedCabinetSessionRole(cabinetToken, secret, nowSeconds);
  if (sessionRole) return sessionRole;
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value ?? null;
  return await readVerifiedCabinetRole(accessToken, secret, nowSeconds);
}

/**
 * Builds the routing context for one request.
 *
 * Conversation history and locale come from the envelope the client sends —
 * they are the reader's own words and carry no authority. Role, page, workspace
 * and object kind come from the server side only.
 */
export async function buildAssistantRoutingContext(
  request: AssistantRequestLike,
  envelope: AssistantContextEnvelope,
  env: NodeJS.ProcessEnv = process.env,
  nowSeconds: number = Math.floor(Date.now() / 1_000),
): Promise<AssistantRoutingContext> {
  const role = await readVerifiedRole(request, env, nowSeconds);
  const page = derivePageFromReferer(
    request.headers.get('referer'),
    (env.NEXT_PUBLIC_SITE_URL || '').trim() || null,
  );

  return emptyRoutingContext(envelope.locale, {
    page,
    insideWorkspace: Boolean(role) && isWorkspacePage(page),
    role,
    authenticated: Boolean(role),
    selectedObject: selectedObjectForPage(page),
    previousTopic: envelope.previousTopic,
    recentMessages: envelope.recentMessages,
    hasAttachment: envelope.hasAttachment,
    // The assistant is itself a platform surface: a question typed into TAI is
    // asked from inside the product, whether or not the reader has signed in.
    onPlatformSurface: true,
    semanticHint: envelope.semanticHint,
  });
}
