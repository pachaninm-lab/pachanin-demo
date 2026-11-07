#!/usr/bin/env python3
"""Bind existing API/web/migration release inputs to immutable Docker images.

No deployment, readiness, rollback compatibility or worker authority is inferred.
Raw Docker inspection output and transport diagnostics are never emitted.
"""

import json
import re
import subprocess
import sys
import tempfile

COMPONENTS = {"api", "web", "migration", "outbox-worker"}
MAX_INSPECT_BYTES = 4 * 1024 * 1024


class BindingError(Exception):
    pass


def require(condition, code):
    if not condition:
        raise BindingError(code)


def repository(component, sha):
    require(component in COMPONENTS, "IMAGE_COMPONENT_INVALID")
    require(isinstance(sha, str) and re.fullmatch(r"[0-9a-f]{40}", sha), "IMAGE_SHA_INVALID")
    return "ghcr.io/pachaninm-lab/grainflow-" + component


def immutable_reference(component, sha, reference):
    repo = repository(component, sha)
    require(isinstance(reference, str) and re.fullmatch(re.escape(repo) + r"@sha256:[0-9a-f]{64}", reference),
            "IMAGE_REFERENCE_INVALID")
    return repo


def docker(args, inspect=True):
    try:
        # A temporary stream bounds memory and is discarded without publishing.
        with tempfile.TemporaryFile() as output:
            subprocess.run(["docker", *args], stdin=subprocess.DEVNULL,
                           stdout=output if inspect else subprocess.DEVNULL,
                           stderr=subprocess.DEVNULL, check=True, timeout=30 if inspect else 300)
            if not inspect:
                return None
            output.seek(0)
            raw = output.read(MAX_INSPECT_BYTES + 1)
    except (OSError, subprocess.SubprocessError):
        raise BindingError("IMAGE_TRANSPORT_FAILED") from None
    require(len(raw) <= MAX_INSPECT_BYTES, "IMAGE_INSPECTION_INVALID")
    try:
        return json.loads(raw)
    except (ValueError, UnicodeError):
        raise BindingError("IMAGE_INSPECTION_INVALID") from None


def one_inspection(records):
    require(isinstance(records, list) and len(records) == 1 and isinstance(records[0], dict),
            "IMAGE_INSPECTION_INVALID")
    return records[0]


def inspect_image(sha, records):
    image = one_inspection(records)
    image_id = image.get("Id")
    require(isinstance(image_id, str) and re.fullmatch(r"sha256:[0-9a-f]{64}", image_id), "IMAGE_ID_INVALID")
    config = image.get("Config")
    require(isinstance(config, dict) and isinstance(config.get("Labels"), dict), "IMAGE_REVISION_INVALID")
    require(config["Labels"].get("org.opencontainers.image.revision") == sha, "IMAGE_REVISION_MISMATCH")
    digests = image.get("RepoDigests")
    require(isinstance(digests, list) and all(isinstance(value, str) for value in digests),
            "IMAGE_REGISTRY_DIGEST_INVALID")
    return image_id, digests


def verify_image(component, sha, reference):
    immutable_reference(component, sha, reference)
    image_id, digests = inspect_image(sha, docker(["image", "inspect", reference]))
    require(digests.count(reference) == 1, "IMAGE_REGISTRY_DIGEST_MISMATCH")
    # Docker image-store implementations may expose the registry target digest
    # as Id. Membership in RepoDigests proves the reference; inequality does not.
    return {
        "schemaVersion": "pc-crop.release-image-binding.v1",
        "classification": "IMAGE_IDENTITY_VERIFIED_NOT_DEPLOYMENT",
        "component": component,
        "sourceCommit": sha,
        "imageReference": reference,
        "registryDigest": reference.split("@", 1)[1],
        "localImageId": image_id,
    }


def resolve_discovery(component, sha, reference):
    repo = repository(component, sha)
    require(reference == repo + ":sha-" + sha[:7], "IMAGE_DISCOVERY_REFERENCE_INVALID")
    discovered_id, digests = inspect_image(sha, docker(["image", "inspect", reference]))
    candidates = [value for value in digests if re.fullmatch(re.escape(repo) + r"@sha256:[0-9a-f]{64}", value)]
    require(len(candidates) == 1, "IMAGE_REGISTRY_DIGEST_AMBIGUOUS")
    verified = verify_image(component, sha, candidates[0])
    require(verified["localImageId"] == discovered_id, "IMAGE_DISCOVERY_ID_CHANGED")
    return candidates[0]


def verify_runtime(component, sha, reference, container_id):
    require(component in {"api", "web", "outbox-worker"}, "RUNTIME_COMPONENT_INVALID")
    immutable_reference(component, sha, reference)
    require(isinstance(container_id, str) and re.fullmatch(r"[0-9a-f]{64}", container_id), "RUNTIME_CONTAINER_ID_INVALID")
    verified = verify_image(component, sha, reference)
    container = one_inspection(docker(["container", "inspect", container_id]))
    require(container.get("Id") == container_id, "RUNTIME_CONTAINER_ID_MISMATCH")
    require(container.get("Image") == verified["localImageId"], "RUNTIME_IMAGE_ID_MISMATCH")
    config = container.get("Config")
    require(isinstance(config, dict) and config.get("Image") == reference, "RUNTIME_IMAGE_REFERENCE_MISMATCH")
    state = container.get("State")
    require(isinstance(state, dict) and state.get("Running") is True, "RUNTIME_NOT_RUNNING")
    # The source revision came from the bound image, never overrideable container labels.
    return sha


def main(argv):
    require(len(argv) in (4, 5), "IMAGE_ARGUMENTS_INVALID")
    mode, component, sha, reference = argv[:4]
    if mode == "runtime":
        require(len(argv) == 5, "IMAGE_ARGUMENTS_INVALID")
        return verify_runtime(component, sha, reference, argv[4])
    require(len(argv) == 4, "IMAGE_ARGUMENTS_INVALID")
    if mode == "resolve":
        return resolve_discovery(component, sha, reference)
    require(mode in {"verify", "pull-verify"}, "IMAGE_MODE_INVALID")
    immutable_reference(component, sha, reference)
    if mode == "pull-verify":
        docker(["pull", reference], inspect=False)
    return json.dumps(verify_image(component, sha, reference), sort_keys=True)


if __name__ == "__main__":
    try:
        print(main(sys.argv[1:]))
    except BindingError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except Exception:
        print("IMAGE_BINDING_FAILED", file=sys.stderr)
        sys.exit(1)
