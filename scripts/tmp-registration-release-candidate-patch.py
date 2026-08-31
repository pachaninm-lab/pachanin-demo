from pathlib import Path


def read(path):
    return Path(path).read_text(encoding='utf-8')


def write(path, text):
    Path(path).write_text(text, encoding='utf-8')


def one(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'PATCH_CARDINALITY_{label}={count}')
    return text.replace(old, new, 1)


def exact_count(text, needle, expected, label):
    count = text.count(needle)
    if count != expected:
        raise SystemExit(f'PATCH_CARDINALITY_{label}={count};expected={expected}')


# 1) Production release: image publication remains automatic, production mutation does not.
path = '.github/workflows/production-full-stack-exact-sha.yml'
s = read(path)
s = one(s, """  workflow_run:\n    workflows: ['Build & Publish Canonical Docker Images']\n    types: [completed]\n    branches: [main]\n""", '', 'FULL_STACK_WORKFLOW_RUN_TRIGGER_REMOVAL')
block = """      (github.event_name == 'workflow_run' &&\n       github.event.workflow_run.conclusion == 'success' &&\n       github.event.workflow_run.event == 'push' &&\n       github.event.workflow_run.head_branch == 'main') ||\n"""
exact_count(s, block, 2, 'FULL_STACK_WORKFLOW_RUN_AUTHORITY_BLOCKS')
s = s.replace(block, '')
s = one(
    s,
    """    runs-on: ubuntu-24.04\n    timeout-minutes: 75\n    steps:\n""",
    """    runs-on: ubuntu-24.04\n    timeout-minutes: 75\n    concurrency:\n      group: pc-crop-production-release-candidate\n      cancel-in-progress: false\n    steps:\n""",
    'FULL_STACK_SHARED_PRODUCTION_LOCK',
)
s = one(
    s,
    "ref: ${{ github.event_name == 'issue_comment' && github.event.repository.default_branch || github.event_name == 'workflow_call' && github.event.repository.default_branch || github.event_name == 'workflow_run' && github.event.workflow_run.head_sha || github.ref_name }}",
    "ref: ${{ github.event_name == 'issue_comment' && github.event.repository.default_branch || github.event_name == 'workflow_call' && github.event.repository.default_branch || github.ref_name }}",
    'FULL_STACK_CHECKOUT_SOURCE',
)
s = one(
    s,
    "target='${{ github.event_name == 'workflow_dispatch' && inputs.target_sha || github.event_name == 'workflow_run' && github.event.workflow_run.head_sha || github.sha }}'",
    "target='${{ github.event_name == 'workflow_dispatch' && inputs.target_sha || github.sha }}'",
    'FULL_STACK_TARGET_SOURCE',
)
s = one(
    s,
    """          if [[ '${{ github.event_name }}' == workflow_run ]]; then\n            [[ '${{ github.event.workflow_run.name }}' == 'Build & Publish Canonical Docker Images' ]]\n            [[ '${{ github.event.workflow_run.conclusion }}' == success ]]\n            [[ '${{ github.event.workflow_run.event }}' == push ]]\n            [[ '${{ github.event.workflow_run.head_branch }}' == main ]]\n          fi\n""",
    '',
    'FULL_STACK_WORKFLOW_RUN_TARGET_GUARD',
)
if 'workflow_run:' in s or "github.event_name == 'workflow_run'" in s:
    raise SystemExit('FULL_STACK_AUTOMATIC_PRODUCTION_AUTHORITY_REMAINS')
write(path, s)

# Contract must prove that a successful image build cannot mutate production.
path = 'scripts/check-production-full-stack-release.mjs'
s = read(path)
for idx, line in enumerate([
    "  'workflow_run:',\n",
    "  \"workflows: ['Build & Publish Canonical Docker Images']\",\n",
    "  \"github.event_name == 'workflow_run'\",\n",
    "  \"github.event.workflow_run.conclusion == 'success'\",\n",
    "  \"github.event.workflow_run.event == 'push'\",\n",
    "  \"github.event.workflow_run.head_branch == 'main'\",\n",
    "  'github.event.workflow_run.head_sha',\n",
    "  \"github.event_name == 'issue_comment' && github.event.repository.default_branch || github.event_name == 'workflow_call' && github.event.repository.default_branch || github.event_name == 'workflow_run' && github.event.workflow_run.head_sha || github.ref_name\",\n",
    "  \"if [[ '${{ github.event_name }}' == workflow_run ]]; then\",\n",
]):
    s = one(s, line, '', f'FULL_STACK_CHECKER_OLD_WORKFLOW_RUN_MARKER_{idx}')
s = one(
    s,
    "  'CONTINUATION_ISSUE_NUMBER: 4637',\n",
    "  'CONTINUATION_ISSUE_NUMBER: 4637',\n  'group: pc-crop-production-release-candidate',\n",
    'FULL_STACK_CHECKER_SHARED_LOCK_MARKER',
)
s = one(
    s,
    "forbid('workflow', [\n",
    "forbid('workflow', [\n  /^\\s{2}workflow_run:/m,\n  /github\\.event_name\\s*==\\s*['\"]workflow_run['\"]/,\n",
    'FULL_STACK_CHECKER_FORBID_AUTO_DEPLOY',
)
write(path, s)

# 2) Mail-worker cutover is a production mutation too; serialize it with acceptance.
path = '.github/workflows/production-auth-mail-outbox-cutover.yml'
s = read(path)
s = one(
    s,
    """    runs-on: ubuntu-24.04\n    timeout-minutes: 35\n    steps:\n""",
    """    runs-on: ubuntu-24.04\n    timeout-minutes: 35\n    concurrency:\n      group: pc-crop-production-release-candidate\n      cancel-in-progress: false\n    steps:\n""",
    'AUTH_MAIL_SHARED_PRODUCTION_LOCK',
)
write(path, s)

# 3) First Customer: main may advance additively; deployed candidate may not change.
path = 'scripts/production-p0-first-customer-acceptance.sh'
s = read(path)
anchor = "p.write_text(s,encoding='utf-8')"
injected = r'''one(
    ''' + "'''" + r'''assert_exact_main() {
  local actual
  actual="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha 2>/dev/null)" \
    || fail P0_EXACT_MAIN_LOOKUP_FAILED 11
  [[ "$actual" == "$TARGET_SHA" ]] || fail P0_MAIN_ADVANCED_DURING_ACCEPTANCE 12
}
''' + "'''" + r''',
    ''' + "'''" + r'''assert_release_candidate() {
  local actual
  actual="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha 2>/dev/null)" \
    || fail P0_CANDIDATE_ANCESTRY_LOOKUP_FAILED 11
  [[ "$actual" =~ ^[0-9a-f]{40}$ ]] || fail P0_CANDIDATE_ANCESTRY_LOOKUP_FAILED 11
  git fetch --no-tags origin main >/dev/null 2>&1 || fail P0_CANDIDATE_ANCESTRY_LOOKUP_FAILED 11
  [[ "$(git rev-parse origin/main)" == "$actual" ]] || fail P0_CANDIDATE_ANCESTRY_LOOKUP_FAILED 11
  git cat-file -e "$TARGET_SHA^{commit}" 2>/dev/null || fail P0_RELEASE_CANDIDATE_NO_LONGER_ANCESTOR 12
  git merge-base --is-ancestor "$TARGET_SHA" "$actual" || fail P0_RELEASE_CANDIDATE_NO_LONGER_ANCESTOR 12
}
''' + "'''" + r''',
    'RELEASE_CANDIDATE_ANCESTRY_GUARD',
)
one(
    ''' + "'''" + r'''def assert_exact_main():
    try:
        result = subprocess.run(
            ['gh', 'api', f"repos/{os.environ['P0_GITHUB_REPOSITORY']}/commits/main", '--jq', '.sha'],
            check=False,
            capture_output=True,
            text=True,
            timeout=20,
        )
    except Exception:
        raise SystemExit(43)
    if result.returncode != 0:
        raise SystemExit(43)
    if result.stdout.strip() != os.environ['P0_TARGET_SHA']:
        raise SystemExit(42)
''' + "'''" + r''',
    ''' + "'''" + r'''def assert_release_candidate():
    try:
        result = subprocess.run(
            ['gh', 'api', f"repos/{os.environ['P0_GITHUB_REPOSITORY']}/commits/main", '--jq', '.sha'],
            check=False, capture_output=True, text=True, timeout=20,
        )
    except Exception:
        raise SystemExit(43)
    if result.returncode != 0:
        raise SystemExit(43)
    actual = result.stdout.strip()
    target = os.environ['P0_TARGET_SHA']
    if actual == target:
        return
    try:
        compare = subprocess.run(
            ['gh', 'api', f"repos/{os.environ['P0_GITHUB_REPOSITORY']}/compare/{target}...{actual}", '--jq', '.status'],
            check=False, capture_output=True, text=True, timeout=20,
        )
    except Exception:
        raise SystemExit(43)
    if compare.returncode != 0:
        raise SystemExit(43)
    if compare.stdout.strip() != 'ahead':
        raise SystemExit(42)
''' + "'''" + r''',
    'MAILBOX_RELEASE_CANDIDATE_ANCESTRY_GUARD',
)
one(
    '  for command in gh curl python3 ssh awk sha256sum; do',
    '  for command in gh git curl python3 ssh awk sha256sum; do',
    'RELEASE_CANDIDATE_GIT_PREREQUISITE',
)
remaining=s.count('assert_exact_main')
if remaining != 7:
    raise SystemExit(f'RELEASE_CANDIDATE_CALL_CARDINALITY_INVALID={remaining}')
s=s.replace('assert_exact_main','assert_release_candidate')
one(
    '    42) fail P0_MAIN_ADVANCED_DURING_ACCEPTANCE 12 ;;\n    43) fail P0_EXACT_MAIN_LOOKUP_FAILED 11 ;;',
    '    42) fail P0_RELEASE_CANDIDATE_NO_LONGER_ANCESTOR 12 ;;\n    43) fail P0_CANDIDATE_ANCESTRY_LOOKUP_FAILED 11 ;;',
    'MAILBOX_RELEASE_CANDIDATE_BLOCKER_MAPPING',
)
if 'P0_RELEASE_CANDIDATE_NO_LONGER_ANCESTOR' not in s or 'git merge-base --is-ancestor' not in s:
    raise SystemExit('RELEASE_CANDIDATE_GUARD_MISSING')
''' + "\n" + anchor
s = one(s, anchor, injected, 'FIRST_CUSTOMER_RELEASE_CANDIDATE_PATCH_INJECTION')
s = one(
    s,
    "  'P0_FIRST_CUSTOMER_READ_RESOURCE_SET_U_PATCH=PASS',\n",
    "  'P0_FIRST_CUSTOMER_READ_RESOURCE_SET_U_PATCH=PASS',\n  'RELEASE_CANDIDATE_ANCESTRY_GUARD',\n  'MAILBOX_RELEASE_CANDIDATE_ANCESTRY_GUARD',\n  'P0_RELEASE_CANDIDATE_NO_LONGER_ANCESTOR',\n",
    'FIRST_CUSTOMER_REQUIRED_CANDIDATE_MARKERS',
)
s = one(
    s,
    "  printf 'P0_FIRST_CUSTOMER_READ_RESOURCE_SET_U_PATCH=PASS\\n'\n",
    "  printf 'P0_FIRST_CUSTOMER_READ_RESOURCE_SET_U_PATCH=PASS\\n'\n  printf 'P0_FIRST_CUSTOMER_RELEASE_CANDIDATE_GUARD=PASS\\n'\n",
    'FIRST_CUSTOMER_VALIDATE_CANDIDATE_MARKER',
)
write(path, s)

path = '.github/workflows/production-p0-first-customer-acceptance.yml'
s = read(path)
s = one(
    s,
    """    runs-on: ubuntu-24.04\n    timeout-minutes: 60\n    permissions:\n""",
    """    runs-on: ubuntu-24.04\n    timeout-minutes: 60\n    concurrency:\n      group: pc-crop-production-release-candidate\n      cancel-in-progress: false\n    permissions:\n""",
    'FIRST_CUSTOMER_SHARED_PRODUCTION_LOCK',
)
s = one(
    s,
    """          guard_main() {\n            [[ \"$(gh api \"repos/$GITHUB_REPOSITORY/commits/main\" --jq .sha)\" == \"$TARGET_SHA\" ]]\n          }\n""",
    """          guard_candidate_ancestry() {\n            local current\n            git fetch --no-tags origin main >/dev/null\n            current=\"$(gh api \"repos/$GITHUB_REPOSITORY/commits/main\" --jq .sha)\"\n            [[ \"$(git rev-parse origin/main)\" == \"$current\" ]]\n            git cat-file -e \"$TARGET_SHA^{commit}\"\n            git merge-base --is-ancestor \"$TARGET_SHA\" \"$current\"\n          }\n""",
    'FIRST_CUSTOMER_SSH_ANCESTRY_FUNCTION',
)
exact_count(s, 'guard_main', 3, 'FIRST_CUSTOMER_SSH_GUARD_CALLS')
s = s.replace('guard_main', 'guard_candidate_ancestry')
s = one(
    s,
    """      - name: Reconfirm exact main immediately before production mutation\n        shell: bash\n        env:\n          TARGET_SHA: ${{ steps.target.outputs.sha }}\n        run: |\n          set -euo pipefail\n          current=\"$(gh api \"repos/$GITHUB_REPOSITORY/commits/main\" --jq .sha)\"\n          [[ \"$current\" == \"$TARGET_SHA\" ]] \\\n            || { echo P0_MAIN_ADVANCED_BEFORE_MUTATION >&2; exit 29; }\n""",
    """      - name: Reconfirm immutable release candidate immediately before production mutation\n        shell: bash\n        env:\n          TARGET_SHA: ${{ steps.target.outputs.sha }}\n        run: |\n          set -euo pipefail\n          git fetch --no-tags origin main >/dev/null\n          current=\"$(gh api \"repos/$GITHUB_REPOSITORY/commits/main\" --jq .sha)\"\n          [[ \"$(git rev-parse origin/main)\" == \"$current\" ]]\n          git cat-file -e \"$TARGET_SHA^{commit}\"\n          git merge-base --is-ancestor \"$TARGET_SHA\" \"$current\" \\\n            || { echo P0_RELEASE_CANDIDATE_NO_LONGER_ANCESTOR >&2; exit 29; }\n""",
    'FIRST_CUSTOMER_PRE_MUTATION_ANCESTRY',
)
ancestry_guard = """git fetch --no-tags origin main >/dev/null\n          current=\"$(gh api \"repos/$GITHUB_REPOSITORY/commits/main\" --jq .sha)\"\n          [[ \"$(git rev-parse origin/main)\" == \"$current\" ]]\n          git cat-file -e \"$TARGET_SHA^{commit}\"\n          git merge-base --is-ancestor \"$TARGET_SHA\" \"$current\""""
exact = '[[ "$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)" == "$TARGET_SHA" ]]'
exact_count(s, exact, 4, 'FIRST_CUSTOMER_TERMINAL_MAIN_GUARDS')
s = s.replace(exact, ancestry_guard)
s = s.replace('Guard exact main before artifact publication', 'Guard immutable release candidate before artifact publication')
s = s.replace('exact-main artifact guard', 'release-candidate artifact guard')
s = s.replace('- exact main: `', '- immutable release candidate: `')
write(path, s)

path = 'scripts/check-production-p0-first-customer-acceptance.mjs'
s = read(path)
s = one(
    s,
    "  'RELEASE_ISSUE_NUMBER: ${{ github.event.issue.number }}',\n",
    "  'RELEASE_ISSUE_NUMBER: ${{ github.event.issue.number }}',\n  'group: pc-crop-production-release-candidate',\n  'Guard immutable release candidate before artifact publication',\n  'git merge-base --is-ancestor',\n",
    'FIRST_CUSTOMER_CHECKER_WORKFLOW_CANDIDATE_MARKERS',
)
s = one(
    s,
    "  'P0_FIRST_CUSTOMER_READ_RESOURCE_SET_U_PATCH=PASS',\n",
    "  'P0_FIRST_CUSTOMER_READ_RESOURCE_SET_U_PATCH=PASS',\n  'RELEASE_CANDIDATE_ANCESTRY_GUARD',\n  'MAILBOX_RELEASE_CANDIDATE_ANCESTRY_GUARD',\n  'P0_FIRST_CUSTOMER_RELEASE_CANDIDATE_GUARD=PASS',\n",
    'FIRST_CUSTOMER_CHECKER_WRAPPER_CANDIDATE_MARKERS',
)
s = one(
    s,
    "  || !validation.stdout.includes('P0_FIRST_CUSTOMER_READ_RESOURCE_SET_U_PATCH=PASS')) {\n",
    "  || !validation.stdout.includes('P0_FIRST_CUSTOMER_READ_RESOURCE_SET_U_PATCH=PASS')\n  || !validation.stdout.includes('P0_FIRST_CUSTOMER_RELEASE_CANDIDATE_GUARD=PASS')) {\n",
    'FIRST_CUSTOMER_CHECKER_VALIDATE_CANDIDATE',
)
write(path, s)

# 4) All-role: consume the immutable candidate proved by the latest successful deep acceptance.
path = 'scripts/production-p0-all-role-registration.sh'
s = read(path)
insert_before = "p.write_text(s,encoding='utf-8')\"\"\",\n    'LABEL_BOUND_COOKIE_JAR_PATCH_INJECTION',\n)"
core_patch = r'''
one(
    ''' + "'''" + r'''assert_exact_main() {
  local actual
  actual="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha 2>/dev/null)" \
    || fail P0_EXACT_MAIN_LOOKUP_FAILED 11
  [[ "$actual" == "$TARGET_SHA" ]] || fail P0_MAIN_ADVANCED_DURING_MATRIX 12
}
''' + "'''" + r''',
    ''' + "'''" + r'''assert_release_candidate() {
  local actual
  actual="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha 2>/dev/null)" \
    || fail P0_CANDIDATE_ANCESTRY_LOOKUP_FAILED 11
  [[ "$actual" =~ ^[0-9a-f]{40}$ ]] || fail P0_CANDIDATE_ANCESTRY_LOOKUP_FAILED 11
  git fetch --no-tags origin main >/dev/null 2>&1 || fail P0_CANDIDATE_ANCESTRY_LOOKUP_FAILED 11
  [[ "$(git rev-parse origin/main)" == "$actual" ]] || fail P0_CANDIDATE_ANCESTRY_LOOKUP_FAILED 11
  git cat-file -e "$TARGET_SHA^{commit}" 2>/dev/null || fail P0_RELEASE_CANDIDATE_NO_LONGER_ANCESTOR 12
  git merge-base --is-ancestor "$TARGET_SHA" "$actual" || fail P0_RELEASE_CANDIDATE_NO_LONGER_ANCESTOR 12
}
''' + "'''" + r''',
    'RELEASE_CANDIDATE_ANCESTRY_GUARD',
)
one(
    ''' + "'''" + r'''def assert_main():
    result = subprocess.run(
        ['gh', 'api', f"repos/{os.environ['P0_GITHUB_REPOSITORY']}/commits/main", '--jq', '.sha'],
        check=False, capture_output=True, text=True, timeout=20,
    )
    if result.returncode != 0:
        raise SystemExit(43)
    if result.stdout.strip() != os.environ['P0_TARGET_SHA']:
        raise SystemExit(42)
''' + "'''" + r''',
    ''' + "'''" + r'''def assert_release_candidate():
    result = subprocess.run(
        ['gh', 'api', f"repos/{os.environ['P0_GITHUB_REPOSITORY']}/commits/main", '--jq', '.sha'],
        check=False, capture_output=True, text=True, timeout=20,
    )
    if result.returncode != 0:
        raise SystemExit(43)
    actual = result.stdout.strip()
    target = os.environ['P0_TARGET_SHA']
    if actual == target:
        return
    compare = subprocess.run(
        ['gh', 'api', f"repos/{os.environ['P0_GITHUB_REPOSITORY']}/compare/{target}...{actual}", '--jq', '.status'],
        check=False, capture_output=True, text=True, timeout=20,
    )
    if compare.returncode != 0:
        raise SystemExit(43)
    if compare.stdout.strip() != 'ahead':
        raise SystemExit(42)
''' + "'''" + r''',
    'MAILBOX_RELEASE_CANDIDATE_ANCESTRY_GUARD',
)
one(
    '  for command in gh curl python3 node ssh awk sha256sum sort; do',
    '  for command in gh git curl python3 node ssh awk sha256sum sort; do',
    'RELEASE_CANDIDATE_GIT_PREREQUISITE',
)
remaining=s.count('assert_exact_main')
if remaining != 8:
    raise SystemExit(f'RELEASE_CANDIDATE_CALL_CARDINALITY_INVALID={remaining}')
s=s.replace('assert_exact_main','assert_release_candidate')
remaining_python=s.count('assert_main()')
if remaining_python != 1:
    raise SystemExit(f'MAILBOX_RELEASE_CANDIDATE_CALL_CARDINALITY_INVALID={remaining_python}')
s=s.replace('assert_main()','assert_release_candidate()')
one(
    '    42) fail P0_MAIN_ADVANCED_DURING_MATRIX 12 ;;\n    43) fail P0_EXACT_MAIN_LOOKUP_FAILED 11 ;;',
    '    42) fail P0_RELEASE_CANDIDATE_NO_LONGER_ANCESTOR 12 ;;\n    43) fail P0_CANDIDATE_ANCESTRY_LOOKUP_FAILED 11 ;;',
    'MAILBOX_RELEASE_CANDIDATE_BLOCKER_MAPPING',
)
if 'P0_RELEASE_CANDIDATE_NO_LONGER_ANCESTOR' not in s or 'git merge-base --is-ancestor' not in s:
    raise SystemExit('RELEASE_CANDIDATE_GUARD_MISSING')
'''
s = one(s, insert_before, core_patch + '\n' + insert_before, 'ALL_ROLE_RELEASE_CANDIDATE_PATCH_INJECTION')
s = one(
    s,
    "  printf 'P0_ALL_ROLE_HTTP_TIMEOUT_ENVELOPE=PASS\\n'\n",
    "  printf 'P0_ALL_ROLE_HTTP_TIMEOUT_ENVELOPE=PASS\\n'\n  printf 'P0_ALL_ROLE_RELEASE_CANDIDATE_GUARD=PASS\\n'\n",
    'ALL_ROLE_VALIDATE_CANDIDATE_MARKER',
)
write(path, s)

path = '.github/workflows/production-p0-all-role-registration.yml'
s = read(path)
s = one(
    s,
    """    runs-on: ubuntu-24.04\n    timeout-minutes: 120\n    permissions:\n""",
    """    runs-on: ubuntu-24.04\n    timeout-minutes: 120\n    concurrency:\n      group: pc-crop-production-release-candidate\n      cancel-in-progress: false\n    permissions:\n""",
    'ALL_ROLE_SHARED_PRODUCTION_LOCK',
)
old_target = """      - name: Resolve exact current main\n        id: target\n        shell: bash\n        env:\n          GH_TOKEN: ${{ github.token }}\n        run: |\n          set -euo pipefail\n          git fetch --no-tags origin main\n          target=\"$(git rev-parse origin/main)\"\n          [[ \"$target\" =~ ^[0-9a-f]{40}$ ]]\n          [[ \"$target\" == \"$(git rev-parse HEAD)\" ]]\n          [[ \"$target\" == \"$(gh api \"repos/$GITHUB_REPOSITORY/commits/main\" --jq .sha)\" ]]\n          echo \"sha=$target\" >> \"$GITHUB_OUTPUT\"\n"""
new_target = """      - name: Resolve immutable candidate from latest deep First Customer Acceptance\n        id: target\n        shell: bash\n        env:\n          GH_TOKEN: ${{ github.token }}\n        run: |\n          set -euo pipefail\n          runs=\"$RUNNER_TEMP/deep-runs.json\"\n          gh api \"repos/$GITHUB_REPOSITORY/actions/workflows/production-p0-first-customer-acceptance.yml/runs?event=issue_comment&status=success&per_page=100\" > \"$runs\"\n          read -r target deep_run_id deep_updated_at < <(node - \"$runs\" <<'NODE'\n          const fs = require('node:fs');\n          const report = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));\n          const matches = (report.workflow_runs || []).filter((run) =>\n            run.head_branch === 'main' &&\n            /^[0-9a-f]{40}$/.test(String(run.head_sha || '')) &&\n            run.status === 'completed' && run.conclusion === 'success'\n          ).sort((a, b) => Number(b.id) - Number(a.id));\n          if (matches.length < 1) process.exit(2);\n          process.stdout.write(`${matches[0].head_sha} ${matches[0].id} ${matches[0].updated_at}\\n`);\n          NODE\n          )\n          [[ \"$target\" =~ ^[0-9a-f]{40}$ ]]\n          [[ \"$deep_run_id\" =~ ^[0-9]{2,20}$ ]]\n          [[ \"$deep_updated_at\" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T ]]\n          git fetch --no-tags origin main\n          current=\"$(gh api \"repos/$GITHUB_REPOSITORY/commits/main\" --jq .sha)\"\n          [[ \"$(git rev-parse origin/main)\" == \"$current\" ]]\n          git cat-file -e \"$target^{commit}\"\n          git merge-base --is-ancestor \"$target\" \"$current\"\n          echo \"sha=$target\" >> \"$GITHUB_OUTPUT\"\n          echo \"deep_run_id=$deep_run_id\" >> \"$GITHUB_OUTPUT\"\n          echo \"deep_updated_at=$deep_updated_at\" >> \"$GITHUB_OUTPUT\"\n          rm -f \"$runs\"\n"""
s = one(s, old_target, new_target, 'ALL_ROLE_TARGET_FROM_DEEP_ACCEPTANCE')
old_query = """          runs=\"$RUNNER_TEMP/deep-runs.json\"\n          gh api \\\n            \"repos/$GITHUB_REPOSITORY/actions/workflows/production-p0-first-customer-acceptance.yml/runs?event=issue_comment&status=success&per_page=100\" \\\n            > \"$runs\"\n          read -r deep_run_id deep_updated_at < <(node - \"$runs\" \"$TARGET_SHA\" <<'NODE'\n          const fs = require('node:fs');\n          const [path, target] = process.argv.slice(2);\n          const report = JSON.parse(fs.readFileSync(path, 'utf8'));\n          const matches = (report.workflow_runs || []).filter((run) =>\n            run.head_sha === target &&\n            run.status === 'completed' &&\n            run.conclusion === 'success'\n          ).sort((a, b) => Number(b.id) - Number(a.id));\n          if (matches.length < 1) process.exit(2);\n          process.stdout.write(`${matches[0].id} ${matches[0].updated_at}\\n`);\n          NODE\n          )\n"""
new_query = """          deep_run_id='${{ steps.target.outputs.deep_run_id }}'\n          deep_updated_at='${{ steps.target.outputs.deep_updated_at }}'\n"""
s = one(s, old_query, new_query, 'ALL_ROLE_REUSE_SELECTED_DEEP_RUN')
s = s.replace('Require same-revision deep First Customer Acceptance', 'Require exact-candidate deep First Customer Acceptance')
s = one(s, '          rm -rf "$deep_dir" "$runs"\n', '          rm -rf "$deep_dir"\n', 'ALL_ROLE_DEEP_RUN_CLEANUP')
s = one(
    s,
    '          [[ "$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)" == "$TARGET_SHA" ]]\n          echo "run_id=$deep_run_id" >> "$GITHUB_OUTPUT"\n',
    '          git fetch --no-tags origin main >/dev/null\n          current="$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)"\n          [[ "$(git rev-parse origin/main)" == "$current" ]]\n          git cat-file -e "$TARGET_SHA^{commit}"\n          git merge-base --is-ancestor "$TARGET_SHA" "$current"\n          echo "run_id=$deep_run_id" >> "$GITHUB_OUTPUT"\n',
    'ALL_ROLE_DEEP_ANCESTRY_GUARD',
)
s = one(
    s,
    """          guard_main() {\n            [[ \"$(gh api \"repos/$GITHUB_REPOSITORY/commits/main\" --jq .sha)\" == \"$TARGET_SHA\" ]]\n          }\n""",
    """          guard_candidate_ancestry() {\n            local current\n            git fetch --no-tags origin main >/dev/null\n            current=\"$(gh api \"repos/$GITHUB_REPOSITORY/commits/main\" --jq .sha)\"\n            [[ \"$(git rev-parse origin/main)\" == \"$current\" ]]\n            git cat-file -e \"$TARGET_SHA^{commit}\"\n            git merge-base --is-ancestor \"$TARGET_SHA\" \"$current\"\n          }\n""",
    'ALL_ROLE_SSH_ANCESTRY_FUNCTION',
)
exact_count(s, 'guard_main', 2, 'ALL_ROLE_SSH_GUARD_CALLS')
s = s.replace('guard_main', 'guard_candidate_ancestry')
exact = '[[ "$(gh api "repos/$GITHUB_REPOSITORY/commits/main" --jq .sha)" == "$TARGET_SHA" ]]'
exact_count(s, exact, 3, 'ALL_ROLE_TERMINAL_MAIN_GUARDS')
terminal_ancestry = """git fetch --no-tags origin main >/dev/null\n          current=\"$(gh api \"repos/$GITHUB_REPOSITORY/commits/main\" --jq .sha)\"\n          [[ \"$(git rev-parse origin/main)\" == \"$current\" ]]\n          git cat-file -e \"$TARGET_SHA^{commit}\"\n          git merge-base --is-ancestor \"$TARGET_SHA\" \"$current\""""
s = s.replace(exact, terminal_ancestry)
s = s.replace('Guard exact main before artifact publication', 'Guard immutable release candidate before artifact publication')
s = s.replace('- exact main: `%s`', '- immutable release candidate: `%s`')
write(path, s)

path = 'scripts/check-production-p0-all-role-registration.mjs'
s = read(path)
s = one(
    s,
    "  'RELEASE_ISSUE_NUMBER: ${{ github.event.issue.number }}',\n",
    "  'RELEASE_ISSUE_NUMBER: ${{ github.event.issue.number }}',\n  'group: pc-crop-production-release-candidate',\n  'Resolve immutable candidate from latest deep First Customer Acceptance',\n  'Require exact-candidate deep First Customer Acceptance',\n  'git merge-base --is-ancestor',\n",
    'ALL_ROLE_CHECKER_WORKFLOW_CANDIDATE_MARKERS',
)
s = one(
    s,
    "  'P0_ALL_ROLE_HTTP_TIMEOUT_ENVELOPE=PASS',\n",
    "  'P0_ALL_ROLE_HTTP_TIMEOUT_ENVELOPE=PASS',\n  'P0_ALL_ROLE_RELEASE_CANDIDATE_GUARD=PASS',\n",
    'ALL_ROLE_CHECKER_RUNNER_CANDIDATE_MARKER',
)
s = one(
    s,
    "  'P0_ALL_ROLE_HTTP_TIMEOUT_ENVELOPE=PASS',\n];\nif (wrapperValidation.status !== 0)",
    "  'P0_ALL_ROLE_HTTP_TIMEOUT_ENVELOPE=PASS',\n  'P0_ALL_ROLE_RELEASE_CANDIDATE_GUARD=PASS',\n];\nif (wrapperValidation.status !== 0)",
    'ALL_ROLE_CHECKER_VALIDATION_CANDIDATE_MARKER',
)
s = s.replace('exact-main deep prerequisite', 'immutable release-candidate deep prerequisite')
write(path, s)

# All touched source must stay syntactically parseable at least at shell level.
for shell in [
    'scripts/production-p0-first-customer-acceptance.sh',
    'scripts/production-p0-all-role-registration.sh',
]:
    import subprocess
    result = subprocess.run(['bash', '-n', shell], text=True, capture_output=True)
    if result.returncode != 0:
        raise SystemExit(f'BASH_SYNTAX_FAILED:{shell}:{result.stderr[:400]}')

print('REGISTRATION_IMMUTABLE_RELEASE_CANDIDATE_PATCH=PASS')
