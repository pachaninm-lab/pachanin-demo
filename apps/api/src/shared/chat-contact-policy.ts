import { Role } from '../common/types/request-user';

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const URL_OR_HANDLE_RE = /(?:https?:\/\/|www\.|t\.me\/|telegram\.me\/|wa\.me\/|api\.whatsapp\.com\/send|@[a-z0-9_]{4,})[^\s]*/i;
const MESSENGER_WITH_HANDLE_RE = /(?:telegram|whatsapp|ватсап|телеграм|tg|вотсап|почта|email|e-mail)\s*[:\-]?\s*[@a-zа-я0-9._-]{4,}/i;
const PHONE_CONTEXT_RE = /(?:\+?7|8)?[\s\-()_.]*\d(?:[\d\s\-()_.]{8,}\d)/;

function normalizeTextForDetection(source: string) {
  return source
    .toLowerCase()
    .replace(/\[(at|собака)\]|\((at|собака)\)|\s+собака\s+|\s+at\s+/gi, '@')
    .replace(/\[(dot|точка|дот)\]|\((dot|точка|дот)\)|\s+(dot|точка|дот)\s+/gi, '.')
    .replace(/t\s*\.\s*me/gi, 't.me')
    .replace(/telegram\s*\.\s*me/gi, 'telegram.me')
    .replace(/wa\s*\.\s*me/gi, 'wa.me')
    .replace(/https?\s*:\s*\/\//gi, 'https://')
    .replace(/www\s*\./gi, 'www.')
    .replace(/[\u2000-\u206F\u2E00-\u2E7F'"`´]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasPhoneLikeSequence(source: string) {
  if (!PHONE_CONTEXT_RE.test(source)) return false;
  const digits = source.replace(/\D/g, '');
  if (digits.length < 10) return false;
  if (digits.length === 10) return true;
  if (digits.length === 11 && ['7', '8'].includes(digits[0])) return true;
  return digits.length > 11;
}

export function detectContactExchange(text?: string | null) {
  const raw = String(text || '').trim();
  if (!raw) {
    return {
      hasDirectContact: false,
      matches: [] as string[]
    };
  }

  const source = normalizeTextForDetection(raw);
  const matches = [
    EMAIL_RE.test(source) ? 'email' : null,
    hasPhoneLikeSequence(source) ? 'phone' : null,
    URL_OR_HANDLE_RE.test(source) ? 'link_or_handle' : null,
    MESSENGER_WITH_HANDLE_RE.test(source) ? 'messenger_handle' : null
  ].filter(Boolean) as string[];

  return {
    hasDirectContact: matches.length > 0,
    matches,
    normalized: source
  };
}

export function canShareDirectContacts(role: Role, roomType?: string | null) {
  if (['ADMIN', 'SUPPORT_MANAGER'].includes(role)) return true;
  return roomType === 'SUPPORT';
}

export function resolveContactRevealPolicy(input: { milestoneReached?: boolean; bypassBand?: 'GREEN' | 'AMBER' | 'RED'; role: Role; roomType?: string | null }) {
  if (canShareDirectContacts(input.role, input.roomType)) return 'VISIBLE';
  if (input.bypassBand === 'RED') return 'HIDDEN';
  if (!input.milestoneReached) return 'HIDDEN';
  return input.bypassBand === 'AMBER' ? 'LIMITED' : 'VISIBLE';
}

export function shouldBlockDirectContactExchange(input: {
  text?: string | null;
  role: Role;
  roomType?: string | null;
  participantOrgIds?: Array<string | null | undefined>;
  milestoneReached?: boolean;
  bypassBand?: 'GREEN' | 'AMBER' | 'RED';
}) {
  const detection = detectContactExchange(input.text);
  if (!detection.hasDirectContact) return { blocked: false, reasonCodes: [] as string[], revealPolicy: resolveContactRevealPolicy(input) };
  if (canShareDirectContacts(input.role, input.roomType)) return { blocked: false, reasonCodes: [] as string[], revealPolicy: 'VISIBLE' };

  const normalizedOrgs = Array.from(new Set((input.participantOrgIds || []).filter(Boolean)));
  const isCrossOrg = normalizedOrgs.length > 1;
  if (!isCrossOrg) return { blocked: false, reasonCodes: [] as string[], revealPolicy: resolveContactRevealPolicy(input) };

  const revealPolicy = resolveContactRevealPolicy(input);
  return {
    blocked: revealPolicy !== 'VISIBLE',
    reasonCodes: detection.matches,
    revealPolicy
  };
}
