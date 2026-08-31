#!/usr/bin/env python3
"""Gekta SPEED #3896 one-factor ubatch 128 -> 256 controller.

This controller intentionally reuses the already-audited, root-owned G3C base
implementation and changes only the candidate ubatch value. It is installed as
/usr/local/sbin/gekta-qwen-g3e and is callable through exact-argument sudoers.
"""

from __future__ import annotations

import importlib.util
import os
import pathlib
import re
import stat
import subprocess
import sys

HELPER_PATH = pathlib.Path("/usr/local/sbin/gekta-qwen-g3e")
BASE_PATH = pathlib.Path(os.environ.get("GEKTA_G3E_BASE_SOURCE", "/usr/local/libexec/gekta-qwen-g3c-base.py"))
STATE_DIR = pathlib.Path("/var/lib/gekta-qwen-g3e")
CANDIDATE_PATH = STATE_DIR / "candidate.json"
BASELINE_PATH = STATE_DIR / "baseline.json"
DROPIN_PATH = pathlib.Path("/etc/systemd/system/tai-qwen3-8b.service.d/110-gekta-g3e.conf")
LOCK_PATH = pathlib.Path("/run/lock/gekta-qwen-g3e.lock")
G3C_CONFLICTS = (
    pathlib.Path("/etc/systemd/system/tai-qwen3-8b.service.d/100-gekta-g3c.conf"),
    pathlib.Path("/var/lib/gekta-qwen-g3c/candidate.json"),
    pathlib.Path("/var/lib/gekta-qwen-g3c/baseline.json"),
)


def _load_base():
    if not BASE_PATH.is_file() or BASE_PATH.is_symlink():
        raise RuntimeError("audited_g3c_base_missing")
    spec = importlib.util.spec_from_file_location("gekta_g3c_base_for_g3e", BASE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("audited_g3c_base_import_failed")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


B = _load_base()

# Isolate all mutable state from historical G3C while reusing its fail-closed
# process snapshot, exact argv/environment preservation, readiness and rollback.
B.HELPER_PATH = HELPER_PATH
B.STATE_DIR = STATE_DIR
B.CANDIDATE_PATH = CANDIDATE_PATH
B.BASELINE_PATH = BASELINE_PATH
B.DROPIN_PATH = DROPIN_PATH
B.LOCK_PATH = LOCK_PATH


def _candidate_argv(argv):
    B._validate_baseline_argv(argv)
    candidate = B._replace_flag(argv, "ubatch_size", b"128", b"256")
    if B._cmdline_bytes(B._normalized_argv(candidate)) != B._cmdline_bytes(B._normalized_argv(argv)):
        B._die("candidate_unrelated_argv_changed")
    for name, expected in B.BASELINE_EXPECTED.items():
        if name != "ubatch_size" and B._flag_value(candidate, name) != expected:
            B._die(f"candidate_unrelated_flag_changed:{name}")
    return candidate


def _candidate_facts_match(facts, metadata):
    if not facts.get("active"):
        return False
    if facts.get("cmdline_sha256") != metadata.get("candidate_cmdline_sha256"):
        return False
    if facts.get("normalized_cmdline_sha256") != metadata.get("normalized_cmdline_sha256"):
        return False
    if facts.get("exe_sha256") != metadata.get("exe_sha256"):
        return False
    if str(facts.get("ubatch_size", "")) != "256":
        return False
    for name, expected in B.BASELINE_EXPECTED.items():
        if name != "ubatch_size" and str(facts.get(name, "")) != expected.decode("ascii"):
            return False
    try:
        B._memory_gate(int(facts.get("mem_available_kb", 0)), int(facts.get("swap_used_kb", 1)))
    except B.G3CError:
        return False
    return True


def _dropin_text() -> str:
    return (
        "# Managed only by /usr/local/sbin/gekta-qwen-g3e for SPEED #3896.\n"
        "[Service]\n"
        "ExecStart=\n"
        "ExecStart=/usr/local/sbin/gekta-qwen-g3e exec\n"
    )


B._candidate_argv = _candidate_argv
B._candidate_facts_match = _candidate_facts_match
B._dropin_text = _dropin_text


def _emit_facts(state: str, result: str, facts) -> None:
    print(f"GEKTA_G3E_STATE={state}")
    print(f"GEKTA_G3E_UBATCH={facts.get('ubatch_size') or 'UNKNOWN'}")
    print(f"GEKTA_G3E_THREADS={facts.get('threads') or 'UNKNOWN'}")
    print(f"GEKTA_G3E_THREADS_BATCH={facts.get('threads_batch') or 'UNKNOWN'}")
    print(f"GEKTA_G3E_PARALLEL={facts.get('parallel') or 'UNKNOWN'}")
    print(f"GEKTA_G3E_CTX_SIZE={facts.get('ctx_size') or 'UNKNOWN'}")
    print(f"GEKTA_G3E_BATCH_SIZE={facts.get('batch_size') or 'UNKNOWN'}")
    print(f"GEKTA_G3E_MEM_AVAILABLE_KB={facts.get('mem_available_kb') or 0}")
    print(f"GEKTA_G3E_SWAP_USED_KB={facts.get('swap_used_kb') or 0}")
    print(f"GEKTA_G3E_RESULT={result}")


def _ubatch256() -> None:
    B._require_root()
    with B._with_lock():
        if any(path.exists() for path in (DROPIN_PATH, CANDIDATE_PATH, BASELINE_PATH)):
            if not all(path.exists() for path in (DROPIN_PATH, CANDIDATE_PATH, BASELINE_PATH)):
                B._die("candidate_state_not_clean")
            metadata = B._load_json(BASELINE_PATH, "gekta.g3c.baseline.v1")
            facts = B._current_facts()
            if _candidate_facts_match(facts, metadata):
                _emit_facts("CANDIDATE", "ALREADY_ACTIVE", facts)
                return
            B._die("candidate_state_drift")

        if any(path.exists() for path in G3C_CONFLICTS):
            B._die("historical_g3c_state_not_clean")

        credential, metadata = B._snapshot_baseline()
        gid = int(metadata["service_gid"])
        STATE_DIR.mkdir(mode=0o750, parents=True, exist_ok=False)
        os.chown(STATE_DIR, 0, gid)
        os.chmod(STATE_DIR, 0o750)
        B._atomic_json(CANDIDATE_PATH, credential, 0o640, 0, gid)
        B._atomic_json(BASELINE_PATH, metadata, 0o600, 0, 0)
        B.DROPIN_DIR.mkdir(mode=0o755, parents=True, exist_ok=True)
        B._atomic_text(DROPIN_PATH, _dropin_text())

        try:
            B._systemctl("daemon-reload")
            B._systemctl("restart", B.SERVICE, timeout=30)
            facts = B._wait_for(
                str(metadata["candidate_cmdline_sha256"]),
                str(metadata["normalized_cmdline_sha256"]),
                str(metadata["exe_sha256"]),
                str(metadata["probe_host"]),
                int(metadata["port"]),
            )
            if not _candidate_facts_match(facts, metadata):
                B._die("candidate_exact_state_not_active")
        except Exception as candidate_error:  # noqa: BLE001
            try:
                B._restore(metadata, cleanup=True)
                print("GEKTA_G3E_AUTO_ROLLBACK=SUCCESS")
            except Exception as rollback_error:  # noqa: BLE001
                print("GEKTA_G3E_AUTO_ROLLBACK=FAILED")
                raise B.G3CError(
                    f"candidate_failed_and_rollback_failed:{candidate_error}:{rollback_error}"
                ) from candidate_error
            raise
        _emit_facts("CANDIDATE", "APPLIED", facts)


def _rollback() -> None:
    B._require_root()
    with B._with_lock():
        own = (DROPIN_PATH, CANDIDATE_PATH, BASELINE_PATH)
        if not any(path.exists() for path in own):
            facts = B._current_facts()
            B._validate_baseline_facts(facts)
            _emit_facts("BASELINE", "ALREADY_BASELINE", facts)
            return
        if not all(path.exists() for path in own):
            B._die("rollback_state_incomplete")
        metadata = B._load_json(BASELINE_PATH, "gekta.g3c.baseline.v1")
        facts = B._restore(metadata, cleanup=True)
        _emit_facts("BASELINE", "ROLLED_BACK", facts)


def _status() -> None:
    B._require_root()
    with B._with_lock():
        facts = B._current_facts()
        if not facts.get("active"):
            print("GEKTA_G3E_STATE=SERVICE_DOWN")
            print("GEKTA_G3E_RESULT=STATUS")
            return
        state = "UNKNOWN"
        own = (DROPIN_PATH, CANDIDATE_PATH, BASELINE_PATH)
        if any(path.exists() for path in own):
            if all(path.exists() for path in own):
                try:
                    metadata = B._load_json(BASELINE_PATH, "gekta.g3c.baseline.v1")
                    if _candidate_facts_match(facts, metadata):
                        state = "CANDIDATE"
                except B.G3CError:
                    pass
        else:
            try:
                B._validate_baseline_facts(facts)
                state = "BASELINE"
            except B.G3CError:
                pass
        _emit_facts(state, "STATUS", facts)


def _exec_candidate() -> None:
    if os.geteuid() == 0:
        B._die("candidate_exec_must_use_service_user")
    data = B._load_json(CANDIDATE_PATH, "gekta.g3c.candidate.v1")
    if os.geteuid() != int(data.get("service_uid", -1)) or os.getegid() != int(data.get("service_gid", -1)):
        B._die("candidate_exec_identity_mismatch")
    exe = pathlib.Path(os.fsdecode(B._unb64(str(data["exe_b64"]))))
    if not exe.is_file() or B._file_sha(exe) != data.get("exe_sha256"):
        B._die("candidate_exec_binary_mismatch")
    argv_raw = data.get("argv_b64")
    env_raw = data.get("env_b64")
    if not isinstance(argv_raw, list) or not isinstance(env_raw, list):
        B._die("candidate_exec_state_invalid")
    argv = [B._unb64(str(item)) for item in argv_raw]
    env: dict[bytes, bytes] = {}
    for pair in env_raw:
        if not isinstance(pair, list) or len(pair) != 2:
            B._die("candidate_exec_environment_invalid")
        key, value = B._unb64(str(pair[0])), B._unb64(str(pair[1]))
        if not key or b"=" in key or b"\0" in key or b"\0" in value or key in env:
            B._die("candidate_exec_environment_invalid")
        env[key] = value
    if B._sha(B._cmdline_bytes(argv)) != data.get("candidate_cmdline_sha256"):
        B._die("candidate_exec_cmdline_digest_mismatch")
    if B._sha(B._cmdline_bytes(B._normalized_argv(argv))) != data.get("normalized_cmdline_sha256"):
        B._die("candidate_exec_normalized_digest_mismatch")
    if B._flag_value(argv, "ubatch_size") != b"256":
        B._die("candidate_exec_ubatch_invalid")
    for name, expected in B.BASELINE_EXPECTED.items():
        if name != "ubatch_size" and B._flag_value(argv, name) != expected:
            B._die(f"candidate_exec_unrelated_flag_invalid:{name}")
    os.execve(os.fsencode(exe), argv, env)


def _bootstrap_check() -> None:
    B._require_root()
    for path, mode in ((HELPER_PATH, 0o755), (pathlib.Path("/usr/local/libexec/gekta-qwen-g3c-base.py"), 0o755)):
        if not path.is_file() or path.is_symlink():
            B._die("installed_file_missing")
        st = path.stat()
        if st.st_uid != 0 or st.st_gid != 0 or stat.S_IMODE(st.st_mode) != mode:
            B._die("installed_file_permissions_invalid")
    if any(path.exists() for path in (DROPIN_PATH, CANDIDATE_PATH, BASELINE_PATH, *G3C_CONFLICTS)):
        B._die("bootstrap_requires_clean_speed_state")
    _, metadata = B._snapshot_baseline()
    print("GEKTA_G3E_BOOTSTRAP=READY")
    print("GEKTA_G3E_BASELINE_UBATCH=128")
    print("GEKTA_G3E_CANDIDATE_UBATCH=256")
    print(f"GEKTA_G3E_BASELINE_CMDLINE_SHA256={metadata['baseline_cmdline_sha256']}")


def _self_test() -> None:
    baseline = [
        b"/opt/llama-server", b"--host", b"127.0.0.1", b"--port", b"8010",
        b"--ctx-size", b"8192", b"--threads", b"16", b"--threads-batch", b"16",
        b"--parallel", b"1", b"--batch-size", b"512", b"--ubatch-size", b"128",
    ]
    candidate = _candidate_argv(baseline)
    assert B._flag_value(candidate, "ubatch_size") == b"256"
    assert B._cmdline_bytes(B._normalized_argv(candidate)) == B._cmdline_bytes(B._normalized_argv(baseline))
    for name in ("threads", "threads_batch", "parallel", "ctx_size", "batch_size"):
        assert B._flag_value(candidate, name) == B.BASELINE_EXPECTED[name]
    print("GEKTA_G3E_SELF_TEST=PASS")


def main() -> int:
    if len(sys.argv) != 2:
        print("GEKTA_G3E_ERROR=invalid_argument_count", file=sys.stderr)
        return 64
    try:
        action = sys.argv[1]
        if action == "ubatch256":
            _ubatch256()
        elif action == "rollback":
            _rollback()
        elif action == "status":
            _status()
        elif action == "exec":
            _exec_candidate()
        elif action == "bootstrap-check":
            _bootstrap_check()
        elif action == "self-test":
            _self_test()
        else:
            B._die("action_not_allowed")
        return 0
    except (B.G3CError, RuntimeError, OSError, subprocess.SubprocessError) as exc:
        safe = re.sub(r"[^A-Za-z0-9_.:-]+", "_", str(exc))[:180] or "unknown"
        print(f"GEKTA_G3E_ERROR={safe}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
