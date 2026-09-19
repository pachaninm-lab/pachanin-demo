// SOC2-003 (audit): before/after контент-отпечаток для audit-событий.
//
// Чистый детерминированный фингерпринт изменения сущности (FNV-1a поверх
// канонического JSON со стабильным порядком ключей). Это НЕ криптографическая
// подпись (она — owner-side, durable WORM-бэкенд), а воспроизводимый отпечаток
// для фиксации before/after и детекта подмены содержимого. Готов к подключению
// в audit-event-helper без изменения существующего поведения.

export function platformV7CanonicalJson(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const out: Record<string, unknown> = {};
    for (const [k, v] of entries) out[k] = sortDeep(v);
    return out;
  }
  return value;
}

// FNV-1a 32-bit → 8-символьный hex. Детерминированно, без внешних зависимостей.
export function platformV7ContentHash(value: unknown): string {
  const input = platformV7CanonicalJson(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export interface PlatformV7BeforeAfterHash {
  readonly beforeHash: string;
  readonly afterHash: string;
  readonly changed: boolean;
}

export function platformV7BeforeAfterHash(before: unknown, after: unknown): PlatformV7BeforeAfterHash {
  const beforeHash = platformV7ContentHash(before);
  const afterHash = platformV7ContentHash(after);
  return { beforeHash, afterHash, changed: beforeHash !== afterHash };
}
