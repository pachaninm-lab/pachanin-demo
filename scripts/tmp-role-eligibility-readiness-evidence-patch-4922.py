from pathlib import Path

workflow_path = Path('.github/workflows/role-eligibility-enforcement-readiness.yml')
checker_path = Path('scripts/check-role-eligibility-readiness-contract.mjs')
workflow = workflow_path.read_text()
checker = checker_path.read_text()


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, got {count}')
    return text.replace(old, new, 1)


workflow = replace_once(
    workflow,
    "        id: corpus\n        env:\n",
    "        id: corpus\n        continue-on-error: true\n        env:\n",
    'corpus continue-on-error',
)

workflow = replace_once(
    workflow,
    '''          set -e
          cat "$EVIDENCE_DIR/runtime.log"
          (( remote_status == 0 )) || exit "$remote_status"
          grep -Fxq ROLE_ELIGIBILITY_READINESS_REPORT=PASS "$EVIDENCE_DIR/runtime.log"
''',
    '''          set -e
          echo "remote_status=$remote_status" >> "$GITHUB_OUTPUT"
          if (( remote_status != 0 )); then
            safe="$EVIDENCE_DIR/blocker-summary.txt"
            grep -E '^(REGISTRATION_RUNTIME_UNCHANGED=PASS|ROLE_ELIGIBILITY_READINESS_DB_MUTATION=0|ROLE_ELIGIBILITY_READINESS_API_SHA=[0-9a-f]{40}|ROLE_ELIGIBILITY_READINESS_WORKER_SHA=[0-9a-f]{40}|ROLE_ELIGIBILITY_READINESS_API_COUNT=[0-9]+|ROLE_ELIGIBILITY_READINESS_WORKER_COUNT=[0-9]+|ROLE_ELIGIBILITY_READINESS_BLOCKER=[A-Z0-9_]+|ROLE_ELIGIBILITY_READINESS_OBSERVER_STATUS=[A-Z0-9_]+|ROLE_ELIGIBILITY_SHADOW_MODE=true|ROLE_ELIGIBILITY_ENFORCEMENT=false|PRODUCTION_DATABASE_MUTATION=0)$' "$EVIDENCE_DIR/runtime.log" > "$safe" || true
            blocker="$(sed -n 's/^ROLE_ELIGIBILITY_READINESS_BLOCKER=//p' "$safe" | tail -n1)"
            api_sha="$(sed -n 's/^ROLE_ELIGIBILITY_READINESS_API_SHA=//p' "$safe" | tail -n1)"
            worker_sha="$(sed -n 's/^ROLE_ELIGIBILITY_READINESS_WORKER_SHA=//p' "$safe" | tail -n1)"
            observer_status="$(sed -n 's/^ROLE_ELIGIBILITY_READINESS_OBSERVER_STATUS=//p' "$safe" | tail -n1)"
            [[ "$blocker" =~ ^[A-Z0-9_]+$ ]] || blocker=ROLE_ELIGIBILITY_READINESS_REMOTE_FAILURE
            [[ "$api_sha" =~ ^[0-9a-f]{40}$ ]] || api_sha=UNKNOWN
            [[ "$worker_sha" =~ ^[0-9a-f]{40}$ ]] || worker_sha=UNKNOWN
            [[ "$observer_status" =~ ^[A-Z0-9_]+$ ]] || observer_status=BLOCKED
            registration_runtime_unchanged=UNKNOWN
            db_mutation=UNKNOWN
            runtime_enforcement=UNKNOWN
            grep -Fxq REGISTRATION_RUNTIME_UNCHANGED=PASS "$safe" && registration_runtime_unchanged=PASS || true
            grep -Eq '^(ROLE_ELIGIBILITY_READINESS_DB_MUTATION|PRODUCTION_DATABASE_MUTATION)=0$' "$safe" && db_mutation=0 || true
            grep -Fxq ROLE_ELIGIBILITY_ENFORCEMENT=false "$safe" && runtime_enforcement=false || true
            echo "blocker=$blocker" >> "$GITHUB_OUTPUT"
            echo "api_sha=$api_sha" >> "$GITHUB_OUTPUT"
            echo "worker_sha=$worker_sha" >> "$GITHUB_OUTPUT"
            echo "observer_status=$observer_status" >> "$GITHUB_OUTPUT"
            echo "registration_runtime_unchanged=$registration_runtime_unchanged" >> "$GITHUB_OUTPUT"
            echo "db_mutation=$db_mutation" >> "$GITHUB_OUTPUT"
            echo "runtime_enforcement=$runtime_enforcement" >> "$GITHUB_OUTPUT"
            cat "$safe"
            rm -f "$EVIDENCE_DIR/runtime.log" "$EVIDENCE_DIR/shadow-corpus.json"
            exit "$remote_status"
          fi
          cat "$EVIDENCE_DIR/runtime.log"
          grep -Fxq ROLE_ELIGIBILITY_READINESS_REPORT=PASS "$EVIDENCE_DIR/runtime.log"
''',
    'remote failure evidence capture',
)

workflow = replace_once(
    workflow,
    "      - name: Publish bounded readiness evidence\n        if: always() && steps.corpus.outcome == 'success'\n        env:\n",
    "      - name: Publish bounded readiness evidence\n        if: always() && (steps.corpus.outcome == 'success' || steps.corpus.outcome == 'failure')\n        env:\n          CORPUS_OUTCOME: ${{ steps.corpus.outcome }}\n          REMOTE_STATUS: ${{ steps.corpus.outputs.remote_status }}\n          BLOCKER: ${{ steps.corpus.outputs.blocker }}\n          API_SHA: ${{ steps.corpus.outputs.api_sha }}\n          WORKER_SHA: ${{ steps.corpus.outputs.worker_sha }}\n          OBSERVER_STATUS: ${{ steps.corpus.outputs.observer_status }}\n          REGISTRATION_RUNTIME_UNCHANGED: ${{ steps.corpus.outputs.registration_runtime_unchanged }}\n          DB_MUTATION: ${{ steps.corpus.outputs.db_mutation }}\n          RUNTIME_ENFORCEMENT: ${{ steps.corpus.outputs.runtime_enforcement }}\n",
    'publish failure condition',
)

workflow = replace_once(
    workflow,
    '''          set -euo pipefail
          cat > "$EVIDENCE_DIR/result.md" <<EOF
''',
    '''          set -euo pipefail
          if [[ "${CORPUS_OUTCOME:-}" == failure ]]; then
            cat > "$EVIDENCE_DIR/result.md" <<EOF
          ## Role Eligibility enforcement-readiness observation \`$GITHUB_RUN_ID\` — BLOCKED

          - target SHA: \`$TARGET_SHA\`
          - observer status: \`${OBSERVER_STATUS:-BLOCKED}\`
          - blocker: \`${BLOCKER:-ROLE_ELIGIBILITY_READINESS_REMOTE_FAILURE}\`
          - production API revision: \`${API_SHA:-UNKNOWN}\`
          - production Role Eligibility worker revision: \`${WORKER_SHA:-UNKNOWN}\`
          - remote report exit: \`${REMOTE_STATUS:-UNKNOWN}\`
          - production DB mutation: \`${DB_MUTATION:-UNKNOWN}\`
          - registration runtime unchanged: \`${REGISTRATION_RUNTIME_UNCHANGED:-UNKNOWN}\`
          - runtime enforcement: \`${RUNTIME_ENFORCEMENT:-UNKNOWN}\`

          \`ROLE_ELIGIBILITY_ENFORCEMENT_READINESS=BLOCKED\`
          \`REGISTRATION_CODE_CHANGED=0\`
          \`REGISTRATION_BEHAVIOR_CHANGED=0\`
          \`ROLE_ELIGIBILITY_ENFORCEMENT=false\`
          EOF
            gh issue comment "$ISSUE_NUMBER" --repo "$GITHUB_REPOSITORY" --body-file "$EVIDENCE_DIR/result.md"
            exit 0
          fi
          cat > "$EVIDENCE_DIR/result.md" <<EOF
''',
    'publish blocker result',
)

workflow = replace_once(
    workflow,
    '''      - name: Fail closed on integrity contradiction
        if: always() && steps.corpus.outcome == 'success'
        env:
          DECISION: ${{ steps.corpus.outputs.decision }}
        shell: bash
        run: |
          set -euo pipefail
          [[ "$DECISION" != BLOCKED_INTEGRITY ]] || {
            echo ROLE_ELIGIBILITY_ENFORCEMENT_READINESS=BLOCKED_INTEGRITY >&2
            exit 40
          }
          echo ROLE_ELIGIBILITY_ENFORCEMENT_READINESS=PENDING
          echo ROLE_ELIGIBILITY_ENFORCEMENT=false
''',
    '''      - name: Enforce fail-closed readiness result
        if: always()
        env:
          CORPUS_OUTCOME: ${{ steps.corpus.outcome }}
          REMOTE_STATUS: ${{ steps.corpus.outputs.remote_status }}
          DECISION: ${{ steps.corpus.outputs.decision }}
          BLOCKER: ${{ steps.corpus.outputs.blocker }}
        shell: bash
        run: |
          set -euo pipefail
          if [[ "${CORPUS_OUTCOME:-}" == failure ]]; then
            echo "ROLE_ELIGIBILITY_ENFORCEMENT_READINESS=BLOCKED:${BLOCKER:-ROLE_ELIGIBILITY_READINESS_REMOTE_FAILURE}" >&2
            if [[ "${REMOTE_STATUS:-}" =~ ^[1-9][0-9]{0,2}$ ]] && (( REMOTE_STATUS <= 255 )); then
              exit "$REMOTE_STATUS"
            fi
            exit 41
          fi
          [[ "${CORPUS_OUTCOME:-}" == success ]] || {
            echo ROLE_ELIGIBILITY_ENFORCEMENT_READINESS=OBSERVATION_NOT_EXECUTED >&2
            exit 42
          }
          [[ "$DECISION" != BLOCKED_INTEGRITY ]] || {
            echo ROLE_ELIGIBILITY_ENFORCEMENT_READINESS=BLOCKED_INTEGRITY >&2
            exit 40
          }
          echo ROLE_ELIGIBILITY_ENFORCEMENT_READINESS=PENDING
          echo ROLE_ELIGIBILITY_ENFORCEMENT=false
''',
    'final fail closed enforcement',
)

checker_anchor = "  'PRODUCTION_DATABASE_MUTATION=0',\n]) need(workflow, token, 'workflow');"
checker_replacement = "  'PRODUCTION_DATABASE_MUTATION=0',\n  'continue-on-error: true',\n  'blocker-summary.txt',\n  'remote_status=$remote_status',\n  \"steps.corpus.outcome == 'failure'\",\n  'Enforce fail-closed readiness result',\n  'ROLE_ELIGIBILITY_ENFORCEMENT_READINESS=BLOCKED',\n]) need(workflow, token, 'workflow');"
checker = replace_once(checker, checker_anchor, checker_replacement, 'checker workflow token anchor')

forbid_anchor = "forbid(workflow, /\\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE)\\b/iu, 'workflow');\n"
forbid_replacement = forbid_anchor + "forbid(workflow, /always\\(\\) && steps[.]corpus[.]outcome == 'success'/u, 'workflow legacy success-only evidence path');\n"
checker = replace_once(checker, forbid_anchor, forbid_replacement, 'checker forbid anchor')

workflow_path.write_text(workflow)
checker_path.write_text(checker)
print('ROLE_ELIGIBILITY_READINESS_BLOCKER_EVIDENCE_PATCH=PASS')
