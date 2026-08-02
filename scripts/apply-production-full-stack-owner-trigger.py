#!/usr/bin/env python3
from pathlib import Path

WORKFLOW = Path('.github/workflows/production-full-stack-exact-sha.yml')
CHECKER = Path('scripts/check-production-full-stack-release.mjs')

workflow = WORKFLOW.read_text(encoding='utf-8')
checker = CHECKER.read_text(encoding='utf-8')

trigger_marker = "\npermissions:\n"
trigger_insert = "\n  issue_comment:\n    types: [created]\n\npermissions:\n"
if trigger_marker not in workflow:
    raise SystemExit('workflow permissions marker missing')
workflow = workflow.replace(trigger_marker, trigger_insert, 1)

contract_marker = "  contract:\n    name: Validate full-stack release contract\n    runs-on: ubuntu-24.04\n"
contract_replacement = """  contract:
    name: Validate full-stack release contract
    if: >-
      github.event_name != 'issue_comment' ||
      (
        github.event.issue.number == 3072 &&
        github.event.comment.user.login == github.repository_owner &&
        github.event.comment.body == '/production full-stack current-main'
      )
    runs-on: ubuntu-24.04
"""
if contract_marker not in workflow:
    raise SystemExit('contract marker missing')
workflow = workflow.replace(contract_marker, contract_replacement, 1)

condition_marker = """    if: >-
      github.event_name == 'push' ||
      (github.event_name == 'workflow_dispatch' &&
       github.actor == github.repository_owner &&
       inputs.confirmation == 'DEPLOY-FULL-STACK-EXACT-SHA')
"""
condition_replacement = """    if: >-
      github.event_name == 'push' ||
      (github.event_name == 'workflow_dispatch' &&
       github.actor == github.repository_owner &&
       inputs.confirmation == 'DEPLOY-FULL-STACK-EXACT-SHA') ||
      (github.event_name == 'issue_comment' &&
       github.event.issue.number == 3072 &&
       github.event.comment.user.login == github.repository_owner &&
       github.event.comment.body == '/production full-stack current-main')
"""
if condition_marker not in workflow:
    raise SystemExit('deploy condition marker missing')
workflow = workflow.replace(condition_marker, condition_replacement, 1)

checkout_marker = """      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Resolve exact current-main target
"""
checkout_replacement = """      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event_name == 'issue_comment' && github.event.repository.default_branch || github.ref_name }}
          fetch-depth: 0

      - name: Resolve exact current-main target
"""
if checkout_marker not in workflow:
    raise SystemExit('deploy checkout marker missing')
workflow = workflow.replace(checkout_marker, checkout_replacement, 1)

target_marker = """          target='${{ github.event_name == 'workflow_dispatch' && inputs.target_sha || github.sha }}'
          [[ "$target" =~ ^[0-9a-f]{40}$ ]]
"""
target_replacement = """          target='${{ github.event_name == 'workflow_dispatch' && inputs.target_sha || github.sha }}'
          if [[ '${{ github.event_name }}' == issue_comment ]]; then
            target="$(git rev-parse origin/main)"
          fi
          [[ "$target" =~ ^[0-9a-f]{40}$ ]]
"""
if target_marker not in workflow:
    raise SystemExit('target resolution marker missing')
workflow = workflow.replace(target_marker, target_replacement, 1)

workflow_needles_anchor = """  'DEPLOY-FULL-STACK-EXACT-SHA',
  'github.actor == github.repository_owner',
"""
workflow_needles_replacement = """  'DEPLOY-FULL-STACK-EXACT-SHA',
  'github.actor == github.repository_owner',
  'issue_comment:',
  "github.event.issue.number == 3072",
  'github.event.comment.user.login == github.repository_owner',
  "github.event.comment.body == '/production full-stack current-main'",
  "github.event_name == 'issue_comment' && github.event.repository.default_branch || github.ref_name",
  "if [[ '${{ github.event_name }}' == issue_comment ]]; then",
"""
if workflow_needles_anchor not in checker:
    raise SystemExit('checker workflow needle anchor missing')
checker = checker.replace(workflow_needles_anchor, workflow_needles_replacement, 1)

forbid_anchor = """forbid('workflow', [
  /sshpass/i,
"""
forbid_replacement = """forbid('workflow', [
  /github\.actor\s*==\s*['\"]github-actions\[bot\]['\"]/,
  /sshpass/i,
"""
if forbid_anchor not in checker:
    raise SystemExit('checker forbid anchor missing')
checker = checker.replace(forbid_anchor, forbid_replacement, 1)

WORKFLOW.write_text(workflow, encoding='utf-8')
CHECKER.write_text(checker, encoding='utf-8')
