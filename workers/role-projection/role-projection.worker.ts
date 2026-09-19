import * as fs from 'fs';
import * as path from 'path';

function runtimeDir() {
  return process.env.RUNTIME_DATA_DIR || path.resolve(process.cwd(), 'var', 'runtime');
}

export async function buildRoleProjection() {
  const dir = runtimeDir();
  const snapshotFile = path.join(dir, 'snapshot.json');
  const projectionFile = path.join(dir, 'role-projections.json');
  if (!fs.existsSync(snapshotFile)) return { ok: false, reason: 'missing_snapshot' };
  const snapshot = JSON.parse(fs.readFileSync(snapshotFile, 'utf-8'));
  const projections = (snapshot.roleJourneys || []).map((role: any) => ({
    roleId: role.id,
    role: role.role,
    firstScreen: role.firstScreen,
    currentGoal: role.currentGoal,
    queue: (snapshot.deals || []).map((deal: any) => ({
      dealId: deal.id,
      stage: deal.stage,
      nextAction: deal.nextAction,
      blockers: deal.blockers || []
    }))
  }));
  fs.writeFileSync(projectionFile, JSON.stringify({ generatedAt: new Date().toISOString(), projections }, null, 2), 'utf-8');
  return { ok: true, roles: projections.length, projectionFile };
}
