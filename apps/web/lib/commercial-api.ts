'use client';
import { applyCsrfHeader } from './csrf';
export class CommercialApiError extends Error { constructor(public status: number, message: string) { super(message); } }
export async function commercialFetch<T>(path: string, init?: RequestInit): Promise<T> { const response = await fetch(`/api/commercial${path.startsWith('/') ? path : `/${path}`}`, { ...init, cache: 'no-store', headers: { ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...Object.fromEntries(new Headers(applyCsrfHeader(init?.headers))) } }); if (!response.ok) { const body = await response.json().catch(() => ({})); throw new CommercialApiError(response.status, body.message || `Ошибка ${response.status}`); } return response.json() as Promise<T>; }
