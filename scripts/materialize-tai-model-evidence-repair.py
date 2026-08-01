#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

OLD_BRANCH = 'fix/tai-reg-ru-model-artifact-evidence-20260801'
NEW_BRANCH = 'fix/tai-reg-ru-model-artifact-evidence-v2-20260801'
EXACT_MAIN = '120539e1256b0c2455b87e6a9c8c00311b2a40b9'


def old_file(path: str) -> str:
    return subprocess.check_output(
        ['git', 'show', f'origin/{OLD_BRANCH}:{path}'],
        text=True,
    )


for path in (
    'scripts/tai_model_artifact_evidence.py',
    'scripts/check-tai-model-artifact-evidence.mjs',
):
    Path(path).write_text(old_file(path), encoding='utf-8')

scope_path = Path(
    'docs/platform-v7/autopilot/scopes/'
    'tai-reg-ru-model-artifact-evidence-20260801.json'
)
scope = json.loads(old_file(str(scope_path)))
scope['branch'] = NEW_BRANCH
scope['status'] = 'active'
scope['authorityBaseExactMain'] = EXACT_MAIN
scope['replacementForPullRequest'] = 3591
scope['mainSynchronization'] = {
    'baseExactMain': EXACT_MAIN,
    'preservedDeterministicFailureEvidence': True,
    'preservedLiveModelArtifactEvidence': True,
}
scope_path.parent.mkdir(parents=True, exist_ok=True)
scope_path.write_text(
    json.dumps(scope, ensure_ascii=False, indent=2) + '\n',
    encoding='utf-8',
)

core_path = Path('scripts/pc-tai-release-controller-core.sh')
core = core_path.read_text(encoding='utf-8')
old_core = old_file(str(core_path))
function_pattern = re.compile(
    r'recover_model_artifact_evidence\(\) \{.*?\n\}\n\nrollback_activation\(\) \{',
    re.S,
)
old_match = function_pattern.search(old_core)
if not old_match:
    raise SystemExit('validated model evidence function missing from source branch')
validated_function = old_match.group(0).removesuffix('\n\nrollback_activation() {')
core, changed = function_pattern.subn(
    validated_function + '\n\nrollback_activation() {',
    core,
    count=1,
)
if changed != 1:
    raise SystemExit(f'main model evidence replacement count: {changed}')

script_anchor = '''    scripts/tai-reg-ru-deploy.sh \\
    scripts/production-full-stack-exact-sha.sh \\
'''
script_replacement = '''    scripts/tai-reg-ru-deploy.sh \\
    scripts/tai_model_artifact_evidence.py \\
    scripts/production-full-stack-exact-sha.sh \\
'''
if script_replacement not in core:
    if core.count(script_anchor) != 1:
        raise SystemExit(f'protected resolver anchor count: {core.count(script_anchor)}')
    core = core.replace(script_anchor, script_replacement, 1)

failure_anchor = '''        "$job_state/full-stack.log" "$job_state/activation.log" "$job_state/deploy.log" \\
        "$job_state/rollback.log" "$job_state/deploy-rollback.log" 2>/dev/null \\
'''
failure_replacement = '''        "$job_state/full-stack.log" "$job_state/activation.log" "$job_state/deploy.log" \\
        "$job_state/model-artifact.log" "$job_state/rollback.log" \\
        "$job_state/deploy-rollback.log" 2>/dev/null \\
'''
if failure_replacement not in core:
    if core.count(failure_anchor) != 1:
        raise SystemExit(f'failure evidence anchor count: {core.count(failure_anchor)}')
    core = core.replace(failure_anchor, failure_replacement, 1)

for required in (
    "grep -hE '^ERROR_CODE=[A-Z][A-Z0-9]*_[A-Z0-9_]+$'",
    'MODEL_ARTIFACT_EVIDENCE_UNAVAILABLE',
    'scripts/tai_model_artifact_evidence.py',
    '"$job_state/model-artifact.log"',
):
    if required not in core:
        raise SystemExit(f'combined controller lost required fragment: {required}')
core_path.write_text(core, encoding='utf-8')

checker_path = Path('scripts/check-pc-tai-release-controller.mjs')
checker = checker_path.read_text(encoding='utf-8')
import_line = "import './check-tai-model-artifact-evidence.mjs';\n"
if import_line not in checker:
    anchor = "import { readFileSync } from 'node:fs';\n"
    if checker.count(anchor) != 1:
        raise SystemExit('controller checker import anchor missing')
    checker = checker.replace(anchor, anchor + import_line, 1)
for required in (
    "grep -hE '^ERROR_CODE=[A-Z][A-Z0-9]*_[A-Z0-9_]+$'",
    'MODEL_KEY_NOT_PROVISIONED',
):
    if required not in checker:
        raise SystemExit(f'main controller contract lost required fragment: {required}')
checker_path.write_text(checker, encoding='utf-8')
