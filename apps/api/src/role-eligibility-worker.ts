import { NestFactory } from '@nestjs/core';
import { createServer, type Server } from 'node:http';
import { RoleEligibilityRegistrySyncService } from './modules/role-eligibility/role-eligibility-registry-sync.service';
import { RoleEligibilityWorkerModule } from './modules/role-eligibility/role-eligibility-worker.module';
import { RoleEligibilityWorkerService } from './modules/role-eligibility/role-eligibility-worker.service';

const POLL_MS = 2_000;
const DISCOVERY_MS = 15_000;
const REGISTRY_SYNC_MS = 6 * 60 * 60 * 1000;
const MAX_QUEUE_DEPTH = 10_000;

type State = {
  startedAt: string;
  lastPollAt: string | null;
  lastSuccessAt: string | null;
  lastRegistrySyncAt: string | null;
  lastErrorCode: string | null;
  processed: number;
  discovered: number;
  registrySyncFailures: number;
  queueDepth: number;
  shuttingDown: boolean;
};

function production(): boolean { return String(process.env.NODE_ENV || '').toLowerCase() === 'production'; }
function positiveInt(value: string | undefined, fallback: number, max: number): number {
  const parsed = Number(value || fallback); return Number.isInteger(parsed) && parsed > 0 && parsed <= max ? parsed : fallback;
}
function sanitize(error: unknown): string {
  return (error instanceof Error ? error.message : String(error || 'UNKNOWN')).toUpperCase().replace(/[^A-Z0-9_:-]/g, '_').slice(0, 120);
}

async function healthServer(state: State, worker: RoleEligibilityWorkerService, port: number): Promise<Server> {
  const server = createServer(async (request, response) => {
    const route = request.url?.split('?', 1)[0] || '/';
    response.setHeader('cache-control', 'no-store'); response.setHeader('content-type', 'application/json');
    if (route === '/live') {
      response.statusCode = state.shuttingDown ? 503 : 200;
      response.end(JSON.stringify({ status: state.shuttingDown ? 'stopping' : 'alive', component: 'role-eligibility-worker' })); return;
    }
    if (route === '/ready') {
      const ready = !state.shuttingDown;
      response.statusCode = ready ? 200 : 503;
      response.end(JSON.stringify({ status: ready ? 'ready' : 'unavailable', component: 'role-eligibility-worker', shadowMode: true, enforcement: false })); return;
    }
    if (route === '/metrics') {
      response.statusCode = 200;
      response.end(JSON.stringify({
        component: 'role-eligibility-worker', processed: state.processed, discovered: state.discovered,
        registrySyncFailures: state.registrySyncFailures, queueDepth: state.queueDepth, lastPollAt: state.lastPollAt,
        lastSuccessAt: state.lastSuccessAt, lastRegistrySyncAt: state.lastRegistrySyncAt, lastErrorCode: state.lastErrorCode,
      })); return;
    }
    response.statusCode = 404; response.end(JSON.stringify({ error: 'not_found' }));
  });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(port, '0.0.0.0', () => { server.off('error', reject); resolve(); }); });
  return server;
}

async function bootstrap(): Promise<void> {
  if (production() && process.env.RUNTIME_COMPONENT !== 'role-eligibility-worker') throw new Error('ROLE_ELIGIBILITY_RUNTIME_COMPONENT_INVALID');
  if (process.env.ROLE_ELIGIBILITY_ENABLED !== 'true') throw new Error('ROLE_ELIGIBILITY_ENABLED_MUST_BE_TRUE');
  if (process.env.ROLE_ELIGIBILITY_SHADOW_MODE !== 'true') throw new Error('ROLE_ELIGIBILITY_SHADOW_MODE_MUST_BE_TRUE');
  if (process.env.ROLE_ELIGIBILITY_ENFORCEMENT === 'true') throw new Error('ROLE_ELIGIBILITY_ENFORCEMENT_MUST_BE_FALSE');

  const app = await NestFactory.createApplicationContext(RoleEligibilityWorkerModule, { logger: ['error', 'warn', 'log'] });
  const worker = app.get(RoleEligibilityWorkerService);
  const registry = app.get(RoleEligibilityRegistrySyncService);
  const state: State = {
    startedAt: new Date().toISOString(), lastPollAt: null, lastSuccessAt: null, lastRegistrySyncAt: null,
    lastErrorCode: null, processed: 0, discovered: 0, registrySyncFailures: 0, queueDepth: 0, shuttingDown: false,
  };
  const port = positiveInt(process.env.ROLE_ELIGIBILITY_WORKER_HEALTH_PORT, 3004, 65_535);
  const server = await healthServer(state, worker, port);
  await worker.recover();

  let lastDiscovery = 0;
  let lastRegistrySync = 0;
  let running: Promise<void> | undefined;
  const tick = () => {
    if (state.shuttingDown || running) return;
    running = (async () => {
      const now = Date.now(); state.lastPollAt = new Date(now).toISOString();
      if (now - lastRegistrySync >= REGISTRY_SYNC_MS) {
        const results = await registry.syncAll();
        state.registrySyncFailures += results.filter((item) => !item.ok).length;
        state.lastRegistrySyncAt = new Date().toISOString(); lastRegistrySync = now;
      }
      state.queueDepth = await app.get('RoleEligibilityWorkerRepository' as never).queueDepth?.().catch?.(() => state.queueDepth) ?? state.queueDepth;
      if (now - lastDiscovery >= DISCOVERY_MS && state.queueDepth < MAX_QUEUE_DEPTH) {
        state.discovered += await worker.discover(250); lastDiscovery = now;
      }
      state.processed += await worker.drain(50);
      state.lastSuccessAt = new Date().toISOString(); state.lastErrorCode = null;
    })().catch((error) => { state.lastErrorCode = sanitize(error); }).finally(() => { running = undefined; });
  };
  const timer = setInterval(tick, positiveInt(process.env.ROLE_ELIGIBILITY_WORKER_INTERVAL_MS, POLL_MS, 60_000));
  timer.unref?.(); tick();

  const shutdown = async () => {
    if (state.shuttingDown) return; state.shuttingDown = true; clearInterval(timer); await running;
    await new Promise<void>((resolve) => server.close(() => resolve())).catch(() => undefined); await app.close();
  };
  process.once('SIGTERM', () => void shutdown()); process.once('SIGINT', () => void shutdown());
}

void bootstrap().catch((error) => { console.error(sanitize(error)); process.exitCode = 1; });
