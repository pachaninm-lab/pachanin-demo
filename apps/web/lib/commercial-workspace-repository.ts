import { promises as fs } from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

export type CommercialWorkspaceMutationMeta = {
  action?: string;
  actor?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  correlationId?: string | null;
  summary?: string | null;
};

const RUNTIME_DIR = path.join(process.cwd(), 'var', 'runtime');
const JSON_PATH = path.join(RUNTIME_DIR, 'commercial-workspace.json');
const SQLITE_PATH = path.join(RUNTIME_DIR, 'commercial-workspace.sqlite');
const STATE_KEY = 'commercial-workspace';
const FILE_LOCK_PATH = `${JSON_PATH}.lock`;
const FILE_LOCK_STALE_MS = 30_000;

function now() {
  return new Date().toISOString();
}

function repositoryMode() {
  const requested = String(process.env.PC_STATE_BACKEND || 'sqlite').trim().toLowerCase();
  return requested === 'file' ? 'file' : 'sqlite';
}

function openDb() {
  const db = new DatabaseSync(SQLITE_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS current_state (
      name TEXT PRIMARY KEY,
      version INTEGER NOT NULL,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS mutation_log (
      id TEXT PRIMARY KEY,
      state_name TEXT NOT NULL,
      version INTEGER NOT NULL,
      action TEXT,
      actor TEXT,
      entity_type TEXT,
      entity_id TEXT,
      correlation_id TEXT,
      summary TEXT,
      created_at TEXT NOT NULL
    );
  `);
  return db;
}

async function ensureJsonState<T>(seed: () => T) {
  await fs.mkdir(RUNTIME_DIR, { recursive: true });
  try {
    await fs.access(JSON_PATH);
  } catch {
    await fs.writeFile(JSON_PATH, JSON.stringify(seed(), null, 2), 'utf8');
  }
}

async function readJsonState<T>(seed: () => T): Promise<T> {
  await ensureJsonState(seed);
  return JSON.parse(await fs.readFile(JSON_PATH, 'utf8')) as T;
}

async function acquireJsonLock(retries = 40, delayMs = 50) {
  await fs.mkdir(RUNTIME_DIR, { recursive: true });
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const handle = await fs.open(FILE_LOCK_PATH, 'wx');
      await handle.writeFile(String(process.pid), 'utf8');
      return async () => {
        try { await handle.close(); } catch {}
        try { await fs.unlink(FILE_LOCK_PATH); } catch {}
      };
    } catch (error: any) {
      if (error?.code !== 'EEXIST') throw error;
      try {
        const stat = await fs.stat(FILE_LOCK_PATH);
        if (Date.now() - stat.mtimeMs > FILE_LOCK_STALE_MS) {
          await fs.unlink(FILE_LOCK_PATH);
          continue;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error('commercial_workspace_file_lock_timeout');
}

async function writeJsonState<T>(next: T) {
  const release = await acquireJsonLock();
  try {
    await fs.mkdir(RUNTIME_DIR, { recursive: true });
    const tempPath = `${JSON_PATH}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(next, null, 2), 'utf8');
    await fs.rename(tempPath, JSON_PATH);
  } finally {
    await release();
  }
}

export async function readWorkspaceState<T>(seed: () => T): Promise<T> {
  await fs.mkdir(RUNTIME_DIR, { recursive: true });
  if (repositoryMode() === 'file') {
    return readJsonState(seed);
  }
  const db = openDb();
  const row = db.prepare('SELECT payload FROM current_state WHERE name = ?').get(STATE_KEY) as { payload?: string } | undefined;
  if (!row?.payload) {
    const initial = seed();
    db.prepare('INSERT INTO current_state(name, version, payload, updated_at) VALUES (?, ?, ?, ?)').run(STATE_KEY, 1, JSON.stringify(initial), now());
    db.close();
    return initial;
  }
  const parsed = JSON.parse(row.payload) as T;
  db.close();
  return parsed;
}

export async function writeWorkspaceState<T>(next: T, meta?: CommercialWorkspaceMutationMeta) {
  await fs.mkdir(RUNTIME_DIR, { recursive: true });
  if (repositoryMode() === 'file') {
    await writeJsonState(next);
    return;
  }

  const db = openDb();
  db.exec('BEGIN IMMEDIATE');
  try {
    const existing = db.prepare('SELECT version FROM current_state WHERE name = ?').get(STATE_KEY) as { version?: number } | undefined;
    const version = Number(existing?.version || 0) + 1;
    if (existing?.version) {
      db.prepare('UPDATE current_state SET version = ?, payload = ?, updated_at = ? WHERE name = ?').run(version, JSON.stringify(next), now(), STATE_KEY);
    } else {
      db.prepare('INSERT INTO current_state(name, version, payload, updated_at) VALUES (?, ?, ?, ?)').run(STATE_KEY, version, JSON.stringify(next), now());
    }
    db.prepare(`
      INSERT INTO mutation_log(id, state_name, version, action, actor, entity_type, entity_id, correlation_id, summary, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      STATE_KEY,
      version,
      meta?.action || 'workspace.write',
      meta?.actor || null,
      meta?.entityType || null,
      meta?.entityId || null,
      meta?.correlationId || null,
      meta?.summary || null,
      now(),
    );
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  } finally {
    db.close();
  }
}

export function getWorkspaceRepositoryMeta() {
  return {
    mode: repositoryMode(),
    jsonPath: JSON_PATH,
    sqlitePath: SQLITE_PATH,
  };
}
