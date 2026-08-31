import { NextRequest } from 'next/server';
import {
  GET as agroChatGet,
  POST as agroChatPost,
} from '../agro-chat/route';
import { selectTurnSafeAgroHistory } from '@/lib/platform-v7/agro-chat-turn-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  return agroChatGet(request);
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const body = bindRequestToCurrentTurn(rawBody);
  const headers = new Headers(request.headers);
  headers.delete('content-length');

  return agroChatPost(new NextRequest(request.url, {
    method: 'POST',
    headers,
    body,
    signal: request.signal,
  }));
}

function bindRequestToCurrentTurn(rawBody: string): string {
  try {
    const decoded = JSON.parse(rawBody) as unknown;
    if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) return rawBody;
    const row = decoded as Record<string, unknown>;
    const question = typeof row.message === 'string' ? row.message.trim() : '';
    return JSON.stringify({
      ...row,
      history: selectTurnSafeAgroHistory(question, row.history),
    });
  } catch {
    return rawBody;
  }
}