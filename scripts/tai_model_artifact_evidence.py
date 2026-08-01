#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import os
import pathlib
import re
import shlex
import stat
import subprocess
from collections import defaultdict

SERVICE_NAME = "tai-qwen3-8b.service"
MODEL_IDENTITY = "tai-qwen3-8b-q4km"
MODEL_HOST = "192.168.0.206"
DEFAULT_CONTEXT_TOKENS = 8192
MIN_CONTEXT_TOKENS = 512
MAX_CONTEXT_TOKENS = 262144


class EvidenceError(RuntimeError):
    pass


def _systemd_runtime() -> tuple[int, str]:
    subprocess.run(
        ["systemctl", "is-active", "--quiet", SERVICE_NAME],
        check=True,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    pid_text = subprocess.check_output(
        ["systemctl", "show", SERVICE_NAME, "--property=MainPID", "--value"],
        text=True,
    ).strip()
    control_group = subprocess.check_output(
        ["systemctl", "show", SERVICE_NAME, "--property=ControlGroup", "--value"],
        text=True,
    ).strip()
    if not pid_text.isdigit() or int(pid_text) < 1:
        raise EvidenceError("invalid model service MainPID")
    if not control_group.startswith("/") or control_group == "/":
        raise EvidenceError("invalid model service ControlGroup")
    return int(pid_text), control_group


def _runtime_authority() -> tuple[int, str, pathlib.Path, pathlib.Path]:
    if os.environ.get("TAI_MODEL_EVIDENCE_TEST_MODE") == "1":
        pid_text = os.environ.get("TAI_MODEL_EVIDENCE_MAIN_PID", "")
        control_group = os.environ.get("TAI_MODEL_EVIDENCE_CONTROL_GROUP", "")
        if not pid_text.isdigit() or int(pid_text) < 1:
            raise EvidenceError("invalid test MainPID")
        if not control_group.startswith("/") or control_group == "/":
            raise EvidenceError("invalid test ControlGroup")
        proc_root = pathlib.Path(os.environ["TAI_MODEL_EVIDENCE_PROC_ROOT"])
        cgroup_root = pathlib.Path(os.environ["TAI_MODEL_EVIDENCE_CGROUP_ROOT"])
        return int(pid_text), control_group, proc_root, cgroup_root

    main_pid, control_group = _systemd_runtime()
    return main_pid, control_group, pathlib.Path("/proc"), pathlib.Path("/sys/fs/cgroup")


def _within(root: pathlib.Path, candidate: pathlib.Path) -> bool:
    return candidate == root or root in candidate.parents


def _service_cgroup(cgroup_root: pathlib.Path, control_group: str) -> pathlib.Path:
    root = cgroup_root.resolve(strict=True)
    candidate = (root / control_group.lstrip("/")).resolve(strict=True)
    if not _within(root, candidate) or candidate == root:
        raise EvidenceError("model service cgroup escapes authority root")
    return candidate


def _service_pids(main_pid: int, cgroup_path: pathlib.Path) -> list[int]:
    pids = {main_pid}
    cgroup_files = {cgroup_path / "cgroup.procs"}
    cgroup_files.update(cgroup_path.rglob("cgroup.procs"))
    for path in sorted(cgroup_files):
        try:
            lines = path.read_text(encoding="utf-8").splitlines()
        except FileNotFoundError:
            continue
        for value in lines:
            value = value.strip()
            if value.isdigit() and int(value) > 0:
                pids.add(int(value))
    if not pids:
        raise EvidenceError("model service cgroup has no processes")
    return sorted(pids)


def _read_nul(path: pathlib.Path) -> list[str]:
    data = path.read_bytes()
    return [item.decode("utf-8", errors="strict") for item in data.split(b"\0") if item]


def _decode_maps_path(value: str) -> str:
    return re.sub(r"\\([0-7]{3})", lambda match: chr(int(match.group(1), 8)), value)


def _candidate_value(value: str) -> str | None:
    value = value.strip().strip("'\"")
    if value.startswith("file://"):
        value = value[7:]
    path = pathlib.Path(value)
    if not path.is_absolute() or path.suffix.lower() != ".gguf":
        return None
    return str(path)


def _extract_token_candidates(tokens: list[str], source: str, candidates: dict[str, set[str]]) -> None:
    for index, token in enumerate(tokens):
        if token in {"-m", "--model"} and index + 1 < len(tokens):
            candidate = _candidate_value(tokens[index + 1])
            if candidate:
                candidates[candidate].add(f"{source}:model-flag")
        elif token.startswith("--model="):
            candidate = _candidate_value(token.split("=", 1)[1])
            if candidate:
                candidates[candidate].add(f"{source}:model-equals")
        else:
            candidate = _candidate_value(token)
            if candidate:
                candidates[candidate].add(f"{source}:gguf-argument")


def _extract_context(tokens: list[str], values: set[int]) -> None:
    for index, token in enumerate(tokens):
        raw: str | None = None
        if token in {"-c", "--ctx-size"} and index + 1 < len(tokens):
            raw = tokens[index + 1]
        elif token.startswith("--ctx-size="):
            raw = token.split("=", 1)[1]
        if raw and raw.isdigit():
            values.add(int(raw))


def _process_evidence(
    proc_root: pathlib.Path,
    pid: int,
    candidates: dict[str, set[str]],
    context_values: set[int],
) -> bool:
    process_root = proc_root / str(pid)
    readable = False

    try:
        cmdline = _read_nul(process_root / "cmdline")
    except (FileNotFoundError, PermissionError, ProcessLookupError):
        cmdline = []
    if cmdline:
        readable = True
        _extract_token_candidates(cmdline, f"pid:{pid}:cmdline", candidates)
        _extract_context(cmdline, context_values)

    try:
        environ = _read_nul(process_root / "environ")
    except (FileNotFoundError, PermissionError, ProcessLookupError):
        environ = []
    if environ:
        readable = True
        for entry in environ:
            if "=" not in entry:
                continue
            key, value = entry.split("=", 1)
            key_upper = key.upper()
            if any(marker in key_upper for marker in ("MODEL", "GGUF", "WEIGHT")):
                direct = _candidate_value(value)
                if direct:
                    candidates[direct].add(f"pid:{pid}:env:{key}")
                try:
                    tokens = shlex.split(value)
                except ValueError:
                    tokens = [value]
                _extract_token_candidates(tokens, f"pid:{pid}:env:{key}", candidates)
            if any(marker in key_upper for marker in ("CTX_SIZE", "CONTEXT_TOKENS", "CONTEXT_SIZE")):
                if value.isdigit():
                    context_values.add(int(value))

    try:
        maps = (process_root / "maps").read_text(encoding="utf-8", errors="strict").splitlines()
    except (FileNotFoundError, PermissionError, ProcessLookupError, UnicodeDecodeError):
        maps = []
    if maps:
        readable = True
        for line in maps:
            parts = line.split(maxsplit=5)
            if len(parts) != 6:
                continue
            candidate = _candidate_value(_decode_maps_path(parts[5]))
            if candidate:
                candidates[candidate].add(f"pid:{pid}:maps")

    fd_root = process_root / "fd"
    try:
        descriptors = list(fd_root.iterdir())
    except (FileNotFoundError, PermissionError, ProcessLookupError):
        descriptors = []
    if descriptors:
        readable = True
        for descriptor in descriptors:
            try:
                target = os.readlink(descriptor)
            except (FileNotFoundError, PermissionError, OSError):
                continue
            candidate = _candidate_value(_decode_maps_path(target))
            if candidate:
                candidates[candidate].add(f"pid:{pid}:fd")

    return readable


def _resolve_model(candidates: dict[str, set[str]]) -> pathlib.Path:
    resolved: dict[pathlib.Path, set[str]] = defaultdict(set)
    rejected: list[str] = []
    for raw, sources in sorted(candidates.items()):
        try:
            path = pathlib.Path(raw).resolve(strict=True)
            metadata = path.stat()
        except (FileNotFoundError, PermissionError, OSError):
            rejected.append(raw)
            continue
        if not stat.S_ISREG(metadata.st_mode) or metadata.st_size < 1:
            rejected.append(raw)
            continue
        resolved[path].update(sources)

    if len(resolved) != 1:
        raise EvidenceError(
            "model artifact authority is ambiguous "
            f"(valid={len(resolved)}, observed={len(candidates)}, rejected={len(rejected)})"
        )
    return next(iter(resolved))


def _sha256(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while block := stream.read(8 * 1024 * 1024):
            digest.update(block)
    return digest.hexdigest()


def build_evidence() -> dict[str, object]:
    main_pid, control_group, proc_root, cgroup_root = _runtime_authority()
    cgroup_path = _service_cgroup(cgroup_root, control_group)
    pids = _service_pids(main_pid, cgroup_path)

    candidates: dict[str, set[str]] = defaultdict(set)
    context_values: set[int] = set()
    readable_processes = 0
    for pid in pids:
        if _process_evidence(proc_root, pid, candidates, context_values):
            readable_processes += 1
    if readable_processes < 1:
        raise EvidenceError("model service process evidence is unreadable")

    path = _resolve_model(candidates)
    if len(context_values) > 1:
        raise EvidenceError("model context authority is ambiguous")
    context_tokens = next(iter(context_values), DEFAULT_CONTEXT_TOKENS)
    if not MIN_CONTEXT_TOKENS <= context_tokens <= MAX_CONTEXT_TOKENS:
        raise EvidenceError("model context authority is invalid")

    metadata = path.stat()
    return {
        "schemaVersion": "tai.restricted-model-artifact.v1",
        "modelIdentity": MODEL_IDENTITY,
        "modelHost": MODEL_HOST,
        "artifactPath": str(path),
        "artifactSha256": _sha256(path),
        "artifactSizeBytes": metadata.st_size,
        "maximumContextTokens": context_tokens,
    }


def main() -> int:
    try:
        payload = build_evidence()
    except (EvidenceError, subprocess.CalledProcessError, KeyError, OSError, ValueError) as error:
        print(f"MODEL_ARTIFACT_EVIDENCE_ERROR={error}", file=os.sys.stderr)
        return 1
    print(json.dumps(payload, sort_keys=True, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
