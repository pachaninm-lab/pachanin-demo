import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the api-client module so auth-session.ts can be imported in Node
vi.mock('./api-client', () => ({ setOn401Handler: vi.fn() }));

// Fixed epoch: 2024-04-06 00:00:00 UTC
const NOW_UNIX = 1712400000;

function makeCookieValue(role: string, exp: number) {
  return encodeURIComponent(JSON.stringify({ role, exp }));
}

function stubCookie(value: string) {
  const doc = { cookie: value ? `pc_session_present=${value}` : '' };
  vi.stubGlobal('document', doc);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW_UNIX * 1000);
  // Default: no cookie
  vi.stubGlobal('document', { cookie: '' });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('getSessionState', () => {
  it('returns unauthenticated when cookie absent', async () => {
    vi.stubGlobal('document', { cookie: '' });
    const { getSessionState } = await import('./auth-session');
    expect(getSessionState().status).toBe('unauthenticated');
  });

  it('returns active for a valid future session', async () => {
    const exp = NOW_UNIX + 3600;
    stubCookie(makeCookieValue('FARMER', exp));
    const { getSessionState } = await import('./auth-session');
    const state = getSessionState();
    expect(state.status).toBe('active');
    if (state.status === 'active') {
      expect(state.role).toBe('FARMER');
      expect(state.expiresAt).toBe(exp * 1000);
    }
  });

  it('returns expired when exp is in the past', async () => {
    const exp = NOW_UNIX - 60;
    stubCookie(makeCookieValue('FARMER', exp));
    const { getSessionState } = await import('./auth-session');
    expect(getSessionState().status).toBe('expired');
  });

  it('returns expiring_soon when <5 min left', async () => {
    const exp = NOW_UNIX + 240; // 4 minutes ahead
    stubCookie(makeCookieValue('ADMIN', exp));
    const { getSessionState } = await import('./auth-session');
    const state = getSessionState();
    expect(state.status).toBe('expiring_soon');
    if (state.status === 'expiring_soon') {
      expect(state.role).toBe('ADMIN');
      expect(state.minutesLeft).toBe(4);
    }
  });

  it('returns active when exactly at 5 min threshold', async () => {
    const exp = NOW_UNIX + 300; // exactly 5 minutes
    stubCookie(makeCookieValue('BUYER', exp));
    const { getSessionState } = await import('./auth-session');
    expect(getSessionState().status).toBe('active');
  });

  it('handles malformed cookie as legacy (GUEST + 1h)', async () => {
    vi.stubGlobal('document', { cookie: 'pc_session_present=not_json_at_all' });
    const { getSessionState } = await import('./auth-session');
    const state = getSessionState();
    expect(state.status).toBe('active');
    if (state.status === 'active') expect(state.role).toBe('GUEST');
  });
});

describe('subscribeSessionState', () => {
  it('calls listener immediately with current state', async () => {
    const exp = NOW_UNIX + 3600;
    stubCookie(makeCookieValue('DRIVER', exp));
    const { subscribeSessionState } = await import('./auth-session');
    const calls: string[] = [];
    const unsub = subscribeSessionState((s) => calls.push(s.status));
    expect(calls).toEqual(['active']);
    unsub();
  });

  it('unsubscribe stops future calls', async () => {
    const exp = NOW_UNIX + 3600;
    stubCookie(makeCookieValue('LAB', exp));
    const { subscribeSessionState } = await import('./auth-session');
    const calls: string[] = [];
    const unsub = subscribeSessionState((s) => calls.push(s.status));
    unsub();
    expect(calls.length).toBe(1); // only the initial emit
  });
});
