'use client';

// CLIENT-SIDE session state management
// Reads the httpOnly-free session marker cookie (pc_session_present)
// and periodically validates the token via /api/auth/refresh

import { setOn401Handler } from './api-client';

const SESSION_COOKIE = 'pc_session_present';
const CHECK_INTERVAL_MS = 3 * 60 * 1000; // check every 3 min
const WARN_BEFORE_EXPIRY_MS = 5 * 60 * 1000; // warn 5 min before expiry

export type SessionState =
  | { status: 'active'; role: string; expiresAt: number }
  | { status: 'expiring_soon'; role: string; expiresAt: number; minutesLeft: number }
  | { status: 'expired' }
  | { status: 'unauthenticated' };

function readSessionCookie(): { role: string; exp: number } | null {
  if (typeof document === 'undefined') return null;
  const raw = document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`))
    ?.split('=')[1];

  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    if (typeof parsed.role !== 'string' || typeof parsed.exp !== 'number') return null;
    return parsed;
  } catch {
    // Legacy: plain string cookie just indicates presence
    return { role: 'GUEST', exp: Date.now() / 1000 + 3600 };
  }
}

function computeState(): SessionState {
  const session = readSessionCookie();
  if (!session) return { status: 'unauthenticated' };

  const nowMs = Date.now();
  const expiresAt = session.exp * 1000;

  if (nowMs >= expiresAt) return { status: 'expired' };

  const msLeft = expiresAt - nowMs;
  if (msLeft < WARN_BEFORE_EXPIRY_MS) {
    return {
      status: 'expiring_soon',
      role: session.role,
      expiresAt,
      minutesLeft: Math.floor(msLeft / 60000),
    };
  }

  return { status: 'active', role: session.role, expiresAt };
}

type Listener = (state: SessionState) => void;
const listeners = new Set<Listener>();

export function subscribeSessionState(fn: Listener): () => void {
  listeners.add(fn);
  fn(computeState()); // emit current state immediately
  return () => listeners.delete(fn);
}

function broadcast() {
  const state = computeState();
  listeners.forEach((fn) => fn(state));
  return state;
}

async function attemptRefresh(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' });
    return res.ok;
  } catch {
    return false;
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startSessionWatcher() {
  if (typeof window === 'undefined') return;
  if (intervalId) return; // already running

  // Handle 401 from api-client
  setOn401Handler(() => {
    broadcast(); // will detect expired/unauthenticated
    redirectToLogin();
  });

  intervalId = setInterval(async () => {
    const state = broadcast();

    if (state.status === 'expired') {
      redirectToLogin();
      return;
    }

    if (state.status === 'expiring_soon') {
      const refreshed = await attemptRefresh();
      if (!refreshed) redirectToLogin();
      else broadcast(); // refresh updated the cookie
    }
  }, CHECK_INTERVAL_MS);

  // Recheck on tab focus (user comes back to tab after long absence)
  window.addEventListener('focus', () => {
    const state = broadcast();
    if (state.status === 'expired') redirectToLogin();
  });
}

export function stopSessionWatcher() {
  if (intervalId) { clearInterval(intervalId); intervalId = null; }
}

function redirectToLogin() {
  if (typeof window === 'undefined') return;
  const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.href = `/login?returnTo=${returnTo}&reason=session_expired`;
}

export function getSessionState(): SessionState {
  return computeState();
}
