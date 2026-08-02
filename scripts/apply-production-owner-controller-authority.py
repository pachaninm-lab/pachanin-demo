#!/usr/bin/env python3
from pathlib import Path

WORKFLOW = Path('.github/workflows/production-full-stack-exact-sha.yml')
CONTROLLER = Path('.github/workflows/platform-v7-safe-merge.yml')
CHECKER = Path('scripts/check-production-full-stack-release.mjs')

workflow = WORKFLOW.read_text(encoding='utf-8')
controller = CONTROLLER.read_text(encoding='utf-8')
checker = CHECKER.read_text(encoding='utf-8')

inputs_needle = """      confirmation:
        description: 'Enter DEPLOY-FULL-STACK-EXACT-SHA'
        required: true
        type: string

permissions:
"""
inputs_replacement = """      confirmation:
        description: 'Enter DEPLOY-FULL-STACK-EXACT-SHA'
        required: true
        type: string
      authorization_run_id:
        description: 'Owner issue-comment controller run ID'
        required: false
        type: string
      authorization_comment_id:
        description: 'Owner release command comment ID'
        required: false
        type: string

permissions:
"""
if inputs_needle not in workflow:
    raise SystemExit('workflow_dispatch input authority anchor missing')
workflow = workflow.replace(inputs_needle, inputs_replacement, 1)

permissions_needle = """permissions:
  contents: read
  packages: read
  issues: write
"""
permissions_replacement = """permissions:
  actions: read
  contents: read
  packages: read
  issues: write
"""
if permissions_needle not in workflow:
    raise SystemExit('workflow permissions anchor missing')
workflow = workflow.replace(permissions_needle, permissions_replacement, 1)

job_if_needle = """    if: >-
      github.event_name == 'push' ||
      (github.event_name == 'workflow_dispatch' &&
       github.actor == github.repository_owner &&
       inputs.confirmation == 'DEPLOY-FULL-STACK-EXACT-SHA')
"""
job_if_replacement = """    if: >-
      github.event_name == 'push' ||
      (github.event_name == 'workflow_dispatch' &&
       inputs.confirmation == 'DEPLOY-FULL-STACK-EXACT-SHA' &&
       (
         github.actor == github.repository_owner ||
         (
           github.actor == 'github-actions[bot]' &&
           inputs.authorization_run_id != '' &&
           inputs.authorization_comment_id != ''
         )
       ))
"""
if job_if_needle not in workflow:
    raise SystemExit('deploy job authority condition anchor missing')
workflow = workflow.replace(job_if_needle, job_if_replacement, 1)

steps_needle = """    timeout-minutes: 75
    steps:
      - uses: actions/checkout@v4
"""
authorization_step = """    timeout-minutes: 75
    steps:
      - name: Authorize exact owner-controlled dispatch
        if: github.event_name == 'workflow_dispatch'
        env:
          GH_TOKEN: ${{ github.token }}
          REPO: ${{ github.repository }}
          OWNER: ${{ github.repository_owner }}
          TARGET_SHA_INPUT: ${{ inputs.target_sha }}
          AUTHORIZATION_RUN_ID: ${{ inputs.authorization_run_id }}
          AUTHORIZATION_COMMENT_ID: ${{ inputs.authorization_comment_id }}
        shell: bash
        run: |
          set -euo pipefail
          if [[ "$GITHUB_ACTOR" == "$OWNER" ]]; then
            [[ -z "${AUTHORIZATION_RUN_ID:-}" && -z "${AUTHORIZATION_COMMENT_ID:-}" ]] || {
              echo 'Direct owner dispatch may not carry delegated authorization.' >&2
              exit 30
            }
            exit 0
          fi

          [[ "$GITHUB_ACTOR" == 'github-actions[bot]' ]] || {
            echo 'Production dispatch actor is not authorized.' >&2
            exit 31
          }
          [[ "$AUTHORIZATION_RUN_ID" =~ ^[0-9]+$ ]] || exit 32
          [[ "$AUTHORIZATION_COMMENT_ID" =~ ^[0-9]+$ ]] || exit 33
          [[ "$TARGET_SHA_INPUT" =~ ^[0-9a-f]{40}$ ]] || exit 34

          run_file="$RUNNER_TEMP/owner-controller-run.json"
          comment_file="$RUNNER_TEMP/owner-release-comment.json"
          gh api -H 'Accept: application/vnd.github+json' \
            "repos/$REPO/actions/runs/$AUTHORIZATION_RUN_ID" > "$run_file"
          gh api -H 'Accept: application/vnd.github+json' \
            "repos/$REPO/issues/comments/$AUTHORIZATION_COMMENT_ID" > "$comment_file"

          python3 - "$run_file" "$comment_file" "$OWNER" "$REPO" "$TARGET_SHA_INPUT" <<'PY_AUTH'
          import json
          import sys
          from datetime import UTC, datetime

          run_path, comment_path, owner, repository, target_sha = sys.argv[1:]
          run = json.load(open(run_path, encoding='utf-8'))
          comment = json.load(open(comment_path, encoding='utf-8'))

          def parse(value):
              if not isinstance(value, str):
                  raise SystemExit('PRODUCTION_OWNER_AUTHORITY_TIMESTAMP_INVALID')
              return datetime.fromisoformat(value.replace('Z', '+00:00')).astimezone(UTC)

          if run.get('path') != '.github/workflows/platform-v7-safe-merge.yml':
              raise SystemExit('PRODUCTION_OWNER_AUTHORITY_WORKFLOW_INVALID')
          if run.get('event') != 'issue_comment':
              raise SystemExit('PRODUCTION_OWNER_AUTHORITY_EVENT_INVALID')
          if (run.get('repository') or {}).get('full_name') != repository:
              raise SystemExit('PRODUCTION_OWNER_AUTHORITY_REPOSITORY_INVALID')
          if (run.get('actor') or {}).get('login') != owner:
              raise SystemExit('PRODUCTION_OWNER_AUTHORITY_ACTOR_INVALID')
          if (run.get('triggering_actor') or {}).get('login') != owner:
              raise SystemExit('PRODUCTION_OWNER_AUTHORITY_TRIGGERING_ACTOR_INVALID')
          if run.get('head_sha') != target_sha:
              raise SystemExit('PRODUCTION_OWNER_AUTHORITY_EXACT_MAIN_MISMATCH')
          if run.get('status') not in {'in_progress', 'completed'}:
              raise SystemExit('PRODUCTION_OWNER_AUTHORITY_RUN_STATUS_INVALID')
          if run.get('status') == 'completed' and run.get('conclusion') != 'success':
              raise SystemExit('PRODUCTION_OWNER_AUTHORITY_RUN_CONCLUSION_INVALID')

          if (comment.get('user') or {}).get('login') != owner:
              raise SystemExit('PRODUCTION_OWNER_AUTHORITY_COMMENT_ACTOR_INVALID')
          if comment.get('body') != '/production release current-main':
              raise SystemExit('PRODUCTION_OWNER_AUTHORITY_COMMAND_INVALID')
          if not str(comment.get('issue_url') or '').endswith('/issues/3072'):
              raise SystemExit('PRODUCTION_OWNER_AUTHORITY_ISSUE_INVALID')

          run_created = parse(run.get('created_at'))
          comment_created = parse(comment.get('created_at'))
          now = datetime.now(UTC)
          if abs((run_created - comment_created).total_seconds()) > 120:
              raise SystemExit('PRODUCTION_OWNER_AUTHORITY_BINDING_INVALID')
          age = (now - comment_created).total_seconds()
          if age < -30 or age > 1800:
              raise SystemExit('PRODUCTION_OWNER_AUTHORITY_EXPIRED')
          PY_AUTH

      - uses: actions/checkout@v4
"""
if steps_needle not in workflow:
    raise SystemExit('deploy steps authority anchor missing')
workflow = workflow.replace(steps_needle, authorization_step, 1)

controller_env_needle = """          GH_TOKEN: ${{ github.token }}
          REPO: ${{ github.repository }}
          COMMAND: ${{ github.event.comment.body }}
"""
controller_env_replacement = """          GH_TOKEN: ${{ github.token }}
          REPO: ${{ github.repository }}
          COMMAND: ${{ github.event.comment.body }}
          COMMENT_ID: ${{ github.event.comment.id }}
"""
if controller_env_needle not in controller:
    raise SystemExit('controller environment anchor missing')
controller = controller.replace(controller_env_needle, controller_env_replacement, 1)

controller_dispatch_needle = """            gh workflow run production-full-stack-exact-sha.yml \\
              --repo "$REPO" \\
              --ref main \\
              -f target_sha="$main_sha" \\
              -f confirmation=DEPLOY-FULL-STACK-EXACT-SHA
"""
controller_dispatch_replacement = """            gh workflow run production-full-stack-exact-sha.yml \\
              --repo "$REPO" \\
              --ref main \\
              -f target_sha="$main_sha" \\
              -f confirmation=DEPLOY-FULL-STACK-EXACT-SHA \\
              -f authorization_run_id="$GITHUB_RUN_ID" \\
              -f authorization_comment_id="$COMMENT_ID"
"""
if controller_dispatch_needle not in controller:
    raise SystemExit('controller dispatch anchor missing')
controller = controller.replace(controller_dispatch_needle, controller_dispatch_replacement, 1)

workflow_require_anchor = """  'github.actor == github.repository_owner',
  'RELEASE_ISSUE_NUMBER: 3072',
"""
workflow_require_replacement = """  'github.actor == github.repository_owner',
  "github.actor == 'github-actions[bot]'",
  'authorization_run_id',
  'authorization_comment_id',
  'Authorize exact owner-controlled dispatch',
  'PRODUCTION_OWNER_AUTHORITY_EXACT_MAIN_MISMATCH',
  'PRODUCTION_OWNER_AUTHORITY_BINDING_INVALID',
  'PRODUCTION_OWNER_AUTHORITY_EXPIRED',
  '.github/workflows/platform-v7-safe-merge.yml',
  'RELEASE_ISSUE_NUMBER: 3072',
"""
if workflow_require_anchor not in checker:
    raise SystemExit('checker workflow authority anchor missing')
checker = checker.replace(workflow_require_anchor, workflow_require_replacement, 1)

controller_require_anchor = """  'gh workflow run production-full-stack-exact-sha.yml',
]);
"""
controller_require_replacement = """  'gh workflow run production-full-stack-exact-sha.yml',
  'COMMENT_ID: ${{ github.event.comment.id }}',
  '-f authorization_run_id="$GITHUB_RUN_ID"',
  '-f authorization_comment_id="$COMMENT_ID"',
]);
"""
if controller_require_anchor not in checker:
    raise SystemExit('checker controller authority anchor missing')
checker = checker.replace(controller_require_anchor, controller_require_replacement, 1)

ordering_anchor = """if (!(publishDispatchIndex >= 0 && imageWatchIndex > publishDispatchIndex && releaseDispatchIndex > imageWatchIndex)) {
  failures.push(`${paths.controller}: exact image publication must complete before release dispatch`);
}
"""
ordering_replacement = ordering_anchor + """const authorizationStepIndex = (text.workflow ?? '').indexOf('Authorize exact owner-controlled dispatch');
const checkoutIndex = (text.workflow ?? '').indexOf('- uses: actions/checkout@v4', authorizationStepIndex);
if (!(authorizationStepIndex >= 0 && checkoutIndex > authorizationStepIndex)) {
  failures.push(`${paths.workflow}: delegated owner authority must be verified before checkout and production access`);
}
const controllerRunInputIndex = controllerSource.indexOf('-f authorization_run_id="$GITHUB_RUN_ID"');
const controllerCommentInputIndex = controllerSource.indexOf('-f authorization_comment_id="$COMMENT_ID"');
if (!(controllerRunInputIndex > releaseDispatchIndex && controllerCommentInputIndex > controllerRunInputIndex)) {
  failures.push(`${paths.controller}: release dispatch must bind controller run and owner comment authority`);
}
"""
if ordering_anchor not in checker:
    raise SystemExit('checker ordering authority anchor missing')
checker = checker.replace(ordering_anchor, ordering_replacement, 1)

forbid_anchor = """forbid('workflow', [
  /sshpass/i,
"""
forbid_replacement = """forbid('workflow', [
  /github[.]actor == 'github-actions\\[bot\\]'[^]*inputs[.]confirmation == 'DEPLOY-FULL-STACK-EXACT-SHA'\\)\\s*$/m,
  /sshpass/i,
"""
if forbid_anchor not in checker:
    raise SystemExit('checker workflow forbid anchor missing')
checker = checker.replace(forbid_anchor, forbid_replacement, 1)

WORKFLOW.write_text(workflow, encoding='utf-8')
CONTROLLER.write_text(controller, encoding='utf-8')
CHECKER.write_text(checker, encoding='utf-8')
