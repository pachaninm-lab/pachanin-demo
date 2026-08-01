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

# Insert the resolver next to the protected deploy script without depending on
# whitespace or surrounding-list formatting that may change between exact-main revisions.
protected_line = 'scripts/tai-reg-ru-deploy.sh \\'
resolver_line = 'scripts/tai_model_artifact_evidence.py \\'
lines = core.splitlines(keepends=True)
if not any(line.strip() == resolver_line for line in lines):
    matches = [index for index, line in enumerate(lines) if line.strip() == protected_line]
    if len(matches) != 1:
        raise SystemExit(f'protected resolver anchor count: {len(matches)}')
    index = matches[0]
    indent = lines[index][:len(lines[index]) - len(lines[index].lstrip())]
    lines.insert(index + 1, f'{indent}{resolver_line}\n')
    core = ''.join(lines)

# Preserve current-main deterministic redacted error extraction and add the new
# model evidence log as one more trusted input to the same strict allowlist.
if '"$job_state/model-artifact.log"' not in core:
    failure_pattern = re.compile(
        r'(?P<indent>^[ \t]*)"\$job_state/full-stack[.]log" "\$job_state/activation[.]log" '
        r'"\$job_state/deploy[.]log" \\\n'
        r'(?P=indent)"\$job_state/rollback[.]log" "\$job_state/deploy-rollback[.]log" 2>/dev/null \\\n',
        re.M,
    )
    match = failure_pattern.search(core)
    if not match:
        raise SystemExit('failure evidence anchor missing')
    indent = match.group('indent')
    replacement = (
        f'{indent}"$job_state/full-stack.log" "$job_state/activation.log" '
        f'"$job_state/deploy.log" \\\n'
        f'{indent}"$job_state/model-artifact.log" "$job_state/rollback.log" \\\n'
        f'{indent}"$job_state/deploy-rollback.log" 2>/dev/null \\\n'
    )
    core = core[:match.start()] + replacement + core[match.end():]

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
