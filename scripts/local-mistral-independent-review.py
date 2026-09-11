#!/usr/bin/env python3
import hashlib
import json
from pathlib import Path
import runpy
import sys

(
    bootstrap_raw,
    diff_raw,
    policy_raw,
    schema_raw,
    paths_raw,
    output_raw,
) = sys.argv[1:]

bootstrap = Path(bootstrap_raw)
diff_path = Path(diff_raw)
policy_path = Path(policy_raw)
schema_path = Path(schema_raw)
paths_path = Path(paths_raw)
output_path = Path(output_raw)

def fail(code):
    raise SystemExit("LOCAL_MISTRAL_ERROR=" + code)

def digest_bytes(data):
    return hashlib.sha256(data).hexdigest()

def digest_file(path):
    return digest_bytes(path.read_bytes())

authority_path = bootstrap / "local-mistral-authority.v1.json"
binding_path = bootstrap / "local-mistral-authority-binding.py.inert"
runner_path = bootstrap / "local-mistral-runner.py.inert"
sensitive_path = bootstrap / "local-mistral-sensitive-output.py.inert"
for path in (authority_path, binding_path, runner_path, sensitive_path):
    if not path.is_file() or path.is_symlink():
        fail("TRUSTED_BOOTSTRAP_INVALID")

binding = runpy.run_path(str(binding_path))
try:
    authority = binding["load_authority"]()
except Exception as exc:
    fail("AUTHORITY_BINDING_INVALID_" + type(exc).__name__.upper())

conversion = authority["conversion"]
model = authority["model"]
runtime = authority["runtime"]
supplied = {
    "conversion_exact_main": conversion["exactMainSha"],
    "conversion_run_id": conversion["workflowRunId"],
    "conversion_run_attempt": conversion["workflowRunAttempt"],
    "model_revision": model["revision"],
    "model_identity": authority["modelIdentity"],
    "conversion_root": conversion["conversionRoot"],
    "conversion_report_sha256": conversion["reportRawSha256"],
    "server_sha256": runtime["serverSha256"],
    "server_size": runtime["serverSizeBytes"],
    "llama_commit": runtime["sourceCommit"],
}
try:
    bound = binding["bind_runtime_arguments"](authority, supplied)
except Exception as exc:
    fail("AUTHORITY_ARGUMENT_BINDING_INVALID_" + type(exc).__name__.upper())

original_argv = sys.argv[:]
try:
    sys.argv = [
        str(runner_path),
        bound["conversion_exact_main"],
        str(bound["conversion_run_id"]),
        str(bound["conversion_run_attempt"]),
        bound["model_revision"],
        bound["model_identity"],
        bound["conversion_root"],
        bound["conversion_report_sha256"],
        bound["server_sha256"],
        str(bound["server_size"]),
        bound["llama_commit"],
        str(diff_path),
        str(policy_path),
        str(schema_path),
        str(paths_path),
        str(output_path),
    ]
    runner = runpy.run_path(str(runner_path))
finally:
    sys.argv = original_argv

sensitive = runpy.run_path(str(sensitive_path))
runtime_handle = None
try:
    runtime_handle = runner["start_local_runtime"]()
    candidate = runner["invoke_model_candidate"](runtime_handle)
    try:
        sensitive["assert_sensitive_output_safe"](candidate)
    except Exception as exc:
        fail("SENSITIVE_OUTPUT_BLOCKED_" + type(exc).__name__.upper())
    violation, canonical = runner["validate_candidate"](candidate)
    if violation is not None or canonical is None:
        fail("CANDIDATE_" + str(violation or "INVALID"))
finally:
    if runtime_handle is not None and not runner["stop_local_runtime"](runtime_handle):
        fail("MODEL_RUNTIME_STOP_FAILED")

canonical_bytes = canonical.encode("utf-8")
diff_bytes = diff_path.read_bytes()
paths = json.loads(paths_path.read_text(encoding="utf-8"))
manifest = {
    "schema": "local-mistral-review-manifest.v1",
    "full_diff_sha256": digest_bytes(diff_bytes),
    "full_diff_bytes": len(diff_bytes),
    "changed_paths": sorted(paths),
}
manifest_bytes = json.dumps(manifest, ensure_ascii=True, sort_keys=True, separators=(",", ":")).encode("utf-8")
result = {
    "content": canonical,
    "authority_sha256": digest_file(authority_path),
    "model_revision": model["revision"],
    "model_sha256": model["artifactSha256"],
    "runtime_source_commit": runtime["sourceCommit"],
    "runtime_server_sha256": runtime["serverSha256"],
    "diff_sha256": manifest["full_diff_sha256"],
    "diff_bytes": manifest["full_diff_bytes"],
    "chunk_count": 1,
    "manifest_sha256": digest_bytes(manifest_bytes),
    "prompt_bundle_sha256": runner["prompt_bundle_sha256"],
    "response_sha256": digest_bytes(canonical_bytes),
}
output_path.write_text(json.dumps(result, ensure_ascii=True, sort_keys=True, separators=(",", ":")) + "\n", encoding="utf-8")
print("LOCAL_MISTRAL_REMOTE_REVIEW_OK=1")
