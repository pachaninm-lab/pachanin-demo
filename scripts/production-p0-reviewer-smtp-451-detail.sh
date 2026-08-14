#!/usr/bin/env bash
set -Eeuo pipefail

: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${PC_REVIEWER_SMTP_451_DETAIL_COMMAND:?PC_REVIEWER_SMTP_451_DETAIL_COMMAND is required}"

COMMAND='/production p0-reviewer-smtp-451-detail current-main'
SOURCE='scripts/production-p0-reviewer-smtp-stage-probe.sh'
SOURCE_BLOB='d4fade37d316e15e9d1bc33fa2fde89929f7db55'
TMP="$RUNNER_TEMP/pc-reviewer-smtp-451-detail.sh"
VALIDATE_ONLY="${PC_REVIEWER_SMTP_451_DETAIL_VALIDATE_ONLY:-0}"

[[ "$PC_REVIEWER_SMTP_451_DETAIL_COMMAND" == "$COMMAND" ]]
[[ "$VALIDATE_ONLY" == '0' || "$VALIDATE_ONLY" == '1' ]]
[[ -f "$SOURCE" ]]
[[ "$(git hash-object "$SOURCE")" == "$SOURCE_BLOB" ]]
rm -f -- "$TMP"
trap 'rm -f -- "$TMP"' EXIT
cp -- "$SOURCE" "$TMP"
chmod 0700 "$TMP"

python3 - "$TMP" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding='utf-8')

replacements = [
    (
        "COMMAND='/production p0-reviewer-smtp-stage-probe current-main'",
        "COMMAND='/production p0-reviewer-smtp-451-detail current-main'",
    ),
    (
        "SMTP_CODE_FAMILY='NONE'\nMAIL_SENT='NO'",
        "SMTP_CODE_FAMILY='NONE'\nENHANCED_STATUS='NONE'\nREASON_CLASS='NONE'\nMAIL_SENT='NO'",
    ),
    (
        "- SMTP code family:",
        "- enhanced SMTP status: $ENHANCED_STATUS\n- safe reason class: $REASON_CLASS\n- SMTP code family:",
    ),
    (
        "import sys\n\ncfg_path, recipient_path = sys.argv[1:3]",
        "import sys\n\nlast_response_text = ''\n\ncfg_path, recipient_path = sys.argv[1:3]",
    ),
    (
        "def emit(result, stage, code='NONE'):\n    family = f'{code[0]}XX' if re.fullmatch(r'[2-5][0-9]{2}', code) else 'NONE'\n    print(f'PROBE_RESULT={result}')\n    print(f'LAST_STAGE={stage}')\n    print(f'SMTP_CODE={code}')\n    print(f'SMTP_CODE_FAMILY={family}')\n    print('MAIL_SENT=NO')\n    print('PRODUCTION_MUTATION=NONE')",
        "def classify_response(text, code):\n    value = str(text or '')[:1024]\n    match = re.search(r'(?<![0-9])([245]\\.[0-9]\\.[0-9]{1,3})(?![0-9])', value)\n    enhanced = match.group(1) if match else 'NONE'\n    lowered = value.lower()\n    if code != '451':\n        return enhanced, 'NONE'\n    groups = [\n        ('RATE_LIMIT', ('rate limit', 'too many', 'quota', 'throttl')),\n        ('GREYLIST_TEMPORARY', ('greylist', 'graylist')),\n        ('ANTI_ABUSE_POLICY', ('spam', 'policy', 'blocked', 'blacklist', 'reputation', 'abuse')),\n        ('DESTINATION_ROUTING_TEMPFAIL', ('dns', 'mx ', 'resolve', 'routing', 'route', 'host', 'network', 'connect')),\n        ('RECIPIENT_TEMPFAIL', ('mailbox', 'recipient', 'user ', 'account')),\n        ('TEMPORARY_POLICY', ('try again', 'temporar', 'later', 'defer')),\n    ]\n    for label, needles in groups:\n        if any(needle in lowered for needle in needles):\n            return enhanced, label\n    return enhanced, 'UNCLASSIFIED_451'\n\ndef emit(result, stage, code='NONE'):\n    family = f'{code[0]}XX' if re.fullmatch(r'[2-5][0-9]{2}', code) else 'NONE'\n    enhanced, reason = classify_response(last_response_text, code)\n    print(f'PROBE_RESULT={result}')\n    print(f'LAST_STAGE={stage}')\n    print(f'SMTP_CODE={code}')\n    print(f'SMTP_CODE_FAMILY={family}')\n    print(f'ENHANCED_STATUS={enhanced}')\n    print(f'REASON_CLASS={reason}')\n    print('MAIL_SENT=NO')\n    print('PRODUCTION_MUTATION=NONE')",
    ),
    (
        "    def read_response():\n        first = stream.readline(4096)\n        if not first or len(first) < 4 or not first[:3].isdigit():\n            return None\n        code = first[:3].decode('ascii', 'strict')\n        if first[3:4] == b'-':\n            while True:\n                line = stream.readline(4096)\n                if not line:\n                    return None\n                if line.startswith(code.encode() + b' '):\n                    break\n        return code",
        "    def read_response():\n        global last_response_text\n        first = stream.readline(4096)\n        if not first or len(first) < 4 or not first[:3].isdigit():\n            last_response_text = ''\n            return None\n        code = first[:3].decode('ascii', 'strict')\n        final_line = first\n        if first[3:4] == b'-':\n            while True:\n                line = stream.readline(4096)\n                if not line:\n                    last_response_text = ''\n                    return None\n                final_line = line\n                if line.startswith(code.encode() + b' '):\n                    break\n        last_response_text = final_line.decode('utf-8', 'replace').strip()[:1024]\n        return code",
    ),
    (
        "family=\"$(grep '^SMTP_CODE_FAMILY=' \"$result_file\" | tail -n1 | cut -d= -f2-)\"\nmail_sent=\"$(grep '^MAIL_SENT=' \"$result_file\" | tail -n1 | cut -d= -f2-)\"",
        "family=\"$(grep '^SMTP_CODE_FAMILY=' \"$result_file\" | tail -n1 | cut -d= -f2-)\"\nenhanced=\"$(grep '^ENHANCED_STATUS=' \"$result_file\" | tail -n1 | cut -d= -f2-)\"\nreason=\"$(grep '^REASON_CLASS=' \"$result_file\" | tail -n1 | cut -d= -f2-)\"\nmail_sent=\"$(grep '^MAIL_SENT=' \"$result_file\" | tail -n1 | cut -d= -f2-)\"",
    ),
    (
        "[[ \"$family\" == 'NONE' || \"$family\" =~ ^[2-5]XX$ ]]\n[[ \"$mail_sent\" == 'NO' ]]",
        "[[ \"$family\" == 'NONE' || \"$family\" =~ ^[2-5]XX$ ]]\n[[ \"$enhanced\" == 'NONE' || \"$enhanced\" =~ ^[245]\\.[0-9]\\.[0-9]{1,3}$ ]]\n[[ \"$reason\" =~ ^(NONE|RATE_LIMIT|GREYLIST_TEMPORARY|ANTI_ABUSE_POLICY|DESTINATION_ROUTING_TEMPFAIL|RECIPIENT_TEMPFAIL|TEMPORARY_POLICY|UNCLASSIFIED_451)$ ]]\n[[ \"$mail_sent\" == 'NO' ]]",
    ),
    (
        "SMTP_CODE_FAMILY=\"$family\"\nMAIL_SENT='NO'",
        "SMTP_CODE_FAMILY=\"$family\"\nENHANCED_STATUS=\"$enhanced\"\nREASON_CLASS=\"$reason\"\nMAIL_SENT='NO'",
    ),
    (
        "printf 'P0_REVIEWER_SMTP_CODE=%s\\n' \"$SMTP_CODE\"",
        "printf 'P0_REVIEWER_SMTP_CODE=%s\\n' \"$SMTP_CODE\"\nprintf 'P0_REVIEWER_SMTP_ENHANCED_STATUS=%s\\n' \"$ENHANCED_STATUS\"\nprintf 'P0_REVIEWER_SMTP_REASON_CLASS=%s\\n' \"$REASON_CLASS\"",
    ),
]

for index, (old, new) in enumerate(replacements, start=1):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'PATCH_CARDINALITY_FAILED:R{index}:{count}')
    text = text.replace(old, new, 1)

for forbidden in [
    "COMMAND='/production p0-reviewer-smtp-stage-probe current-main'",
    "def emit(result, stage, code='NONE'):\n    family = f'{code[0]}XX' if re.fullmatch(r'[2-5][0-9]{2}', code) else 'NONE'\n    print(f'PROBE_RESULT={result}')",
]:
    if forbidden in text:
        raise SystemExit('POST_TRANSFORM_OLD_FRAGMENT_PRESENT')

path.write_text(text, encoding='utf-8')
PY

bash -n "$TMP"
python3 - "$TMP" <<'PY'
from pathlib import Path
import sys
text = Path(sys.argv[1]).read_text(encoding='utf-8')
start = text.index("cat > \"$remote_tmp/probe.py\" <<'PY'\n") + len("cat > \"$remote_tmp/probe.py\" <<'PY'\n")
end = text.index("\nPY\nchmod 0700 \"$remote_tmp/probe.py\"", start)
source = text[start:end]
compile(source, '<probe.py>', 'exec')
for forbidden in ["sock.sendall(b'DATA", "command('DATA'", 'api/auth/forgot-password']:
    if forbidden in source:
        raise SystemExit(f'FORBIDDEN_PROBE_OPERATION:{forbidden}')
print('PASS: transformed SMTP 451 detail probe Python compiles and remains pre-DATA')
PY

if [[ "$VALIDATE_ONLY" == '1' ]]; then
  printf '%s\n' 'PASS: transformed reviewer SMTP 451 detail wrapper validated'
  exit 0
fi

bash "$TMP"
