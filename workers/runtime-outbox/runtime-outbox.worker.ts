import * as fs from 'fs';
import * as path from 'path';

type OutboxRecord = {
  id: string;
  topic: string;
  status: 'PENDING'|'PROCESSED'|'FAILED';
  createdAt: string;
  aggregateType?: string;
  aggregateId?: string;
  payload?: unknown;
  processedAt?: string | null;
};

function runtimeDir() {
  return process.env.RUNTIME_DATA_DIR || path.resolve(process.cwd(), 'var', 'runtime');
}

function readNdjson<T>(file: string): T[] {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf-8').split('\n').filter(Boolean).map((line) => {
    try { return JSON.parse(line) as T; } catch { return null; }
  }).filter(Boolean) as T[];
}

function writeNdjson<T>(file: string, rows: T[]) {
  fs.writeFileSync(file, rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : ''), 'utf-8');
}

export async function processRuntimeOutbox(limit = 100) {
  const dir = runtimeDir();
  const pendingFile = path.join(dir, 'outbox.ndjson');
  const processedFile = path.join(dir, 'outbox-processed.ndjson');
  const pending = readNdjson<OutboxRecord>(pendingFile);
  const chunk = pending.slice(0, limit);
  const rest = pending.slice(limit);
  const processed = chunk.map((item) => ({ ...item, status: 'PROCESSED' as const, processedAt: new Date().toISOString() }));
  writeNdjson(pendingFile, rest);
  if (processed.length) {
    fs.appendFileSync(processedFile, processed.map((item) => JSON.stringify(item)).join('\n') + '\n', 'utf-8');
  }
  return { processed: processed.length, items: processed };
}
