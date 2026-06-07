#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const engine = String(process.argv[2] || 'unknown').trim();
const allowedEngines = new Set(['openai', 'fallback', 'unknown']);

if (!allowedEngines.has(engine)) {
  console.error(`ERROR: unsupported agent engine audit value: ${engine}`);
  process.exit(2);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return {};
  }
}

function cleanRunId(value) {
  const raw = String(value || 'local').trim() || 'local';
  return raw.replace(/[^A-Za-z0-9._-]/g, '-');
}

const state = readJson('docs/platform-v7/autopilot/autopilot-state.json');
const progress = readJson('docs/platform-v7/autopilot/progress.json');
const runId = cleanRunId(process.env.GITHUB_RUN_ID);
const issueNumber = process.env.ISSUE_NUMBER ? Number(process.env.ISSUE_NUMBER) : null;
const branchName = process.env.P7_AGENT_BRANCH_NAME || process.env.P7_AGENT_BRANCH || null;
const currentStep = process.env.P7_AGENT_CURRENT_STEP || progress.currentStep || state.current || null;
const agentWritableScope = Array.isArray(state.agentWritableScope) ? state.agentWritableScope : [];

const record = {
  timestamp: new Date().toISOString(),
  engine,
  runId,
  issueNumber: Number.isFinite(issueNumber) ? issueNumber : null,
  branchName,
  currentStep,
  agentWritableScope,
  openaiRealCodingProven: engine === 'openai',
  fallbackUsed: engine === 'fallback',
  note:
    engine === 'openai'
      ? 'OpenAI API produced an accepted diff inside the exact agent writable scope.'
      : engine === 'fallback'
        ? 'Deterministic fallback produced the accepted diff; OpenAI real coding is not proven by this run.'
        : 'Agent engine could not be determined for this run.',
};

const auditDir = 'docs/platform-v7/autopilot/audit';
fs.mkdirSync(auditDir, { recursive: true });

const auditPath = path.join(auditDir, `agent-engine-${runId}.json`);
fs.writeFileSync(auditPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');

console.log(`agent engine audit written: ${auditPath}`);
