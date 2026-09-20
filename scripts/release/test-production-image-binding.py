#!/usr/bin/env python3
"""Execute actual verifier/workflow/executor code with synthetic Docker only."""

import copy
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
VERIFIER = ROOT / "scripts/release/verify-production-image-binding.py"
EXECUTOR = ROOT / "scripts/production-full-stack-exact-sha.sh"
WORKFLOW = ROOT / ".github/workflows/production-full-stack-exact-sha.yml"
SHA = "a" * 40
CANARY = "SYNTHETIC_PROTECTED_IMAGE_CANARY"
CID = {"api": "1" * 64, "web": "2" * 64, "outbox-worker": "3" * 64}
BROKER_CID = "4" * 64
KAFKA_IMAGE = "confluentinc/cp-kafka@sha256:24cdd3a7fa89d2bed150560ebea81ff1943badfa61e51d66bb541a6b0d7fb047"
REPOS = {component: "ghcr.io/pachaninm-lab/grainflow-" + component for component in ("api", "web", "migration", "outbox-worker")}
REFS = {component: repo + "@sha256:" + str(index) * 64 for index, (component, repo) in enumerate(REPOS.items(), 3)}


def shell_step(name):
    source = WORKFLOW.read_text().split("      - name: " + name + "\n", 1)[1]
    source = source.split("\n      - name:", 1)[0].split("        run: |\n", 1)[1]
    return "\n".join(line[10:] if line.startswith(" " * 10) else line for line in source.splitlines())


class BindingTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="release-image-fixture-")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.bin = self.root / "bin"
        self.bin.mkdir()
        self.log = self.root / "docker.jsonl"
        self.data = {"images": {}, "containers": {}, "pullStatus": 0}
        for index, component in enumerate(REPOS, 6):
            image = {"Id": "sha256:" + str(index) * 64, "RepoDigests": [REFS[component]],
                     "Config": {"Labels": {"org.opencontainers.image.revision": SHA,
                                           "protected.path": "/srv/" + CANARY},
                                "Env": ["SECRET=" + CANARY]}}
            self.data["images"][REFS[component]] = [image]
            self.data["images"][REPOS[component] + ":sha-" + SHA[:7]] = [copy.deepcopy(image)]
            if component in CID:
                self.data["containers"][CID[component]] = [{"Id": CID[component], "Image": image["Id"],
                    "Config": {"Image": REFS[component], "Labels": {"org.opencontainers.image.revision": SHA},
                               "Env": ["SECRET=" + CANARY]}, "State": {"Running": True}}]
        self.data["images"][KAFKA_IMAGE] = [{"Id": "sha256:" + "f" * 64, "RepoDigests": [KAFKA_IMAGE],
            "Config": {"Labels": {}, "Env": []}}]
        self.data["containers"][BROKER_CID] = [{"Id": BROKER_CID, "Image": "sha256:" + "f" * 64,
            "Config": {"Image": KAFKA_IMAGE, "Labels": {}, "Env": []}, "State": {"Running": True}}]
        fake = self.bin / "docker"
        fake.write_text("""#!/usr/bin/env python3
import json, os, pathlib, sys
args = sys.argv[1:]
with open(os.environ['IMAGE_TEST_LOG'], 'a') as log:
    log.write(json.dumps(args) + '\\n')
data = json.loads(pathlib.Path(os.environ['IMAGE_TEST_DATA']).read_text())
if args[:1] == ['login']:
    sys.exit(0)
if args[:1] == ['pull']:
    print(os.environ['IMAGE_TEST_CANARY'])
    print(os.environ['IMAGE_TEST_CANARY'], file=sys.stderr)
    sys.exit(data['pullStatus'])
if args[:2] == ['compose', 'ps']:
    print({'api': '1' * 64, 'web': '2' * 64, 'outbox-worker': '3' * 64, 'ir20-kafka': '4' * 64}[args[-1]])
    sys.exit(0)
if args[:2] == ['image', 'inspect']:
    value = data['images'].get(args[2])
elif args[:2] == ['container', 'inspect']:
    value = data['containers'].get(args[2])
elif args[:1] == ['inspect'] and '.Config.Image' in args[args.index('--format')+1]:
    print(data['containers'][args[-1]][0]['Config']['Image']); sys.exit(0)
else:
    value = None
if value is None:
    print(os.environ['IMAGE_TEST_CANARY'], file=sys.stderr)
    sys.exit(45)
if isinstance(value, str):
    print(value)
else:
    print(json.dumps(value))
""")
        fake.chmod(0o700)
        self.fixture = self.root / "docker-data.json"
        self.env = dict(os.environ, PATH=str(self.bin) + os.pathsep + os.environ["PATH"],
                        IMAGE_TEST_LOG=str(self.log), IMAGE_TEST_DATA=str(self.fixture),
                        IMAGE_TEST_CANARY=CANARY, TARGET_SHA=SHA, IMAGE_BINDING_VERIFIER=str(VERIFIER),
                        API_IMAGE=REFS["api"], WEB_IMAGE=REFS["web"], MIGRATION_IMAGE=REFS["migration"],
                        OUTBOX_WORKER_IMAGE=REFS["outbox-worker"], KAFKA_IMAGE=KAFKA_IMAGE)

    def execute(self, command, env=None):
        self.fixture.write_text(json.dumps(self.data))
        result = subprocess.run(command, env=self.env if env is None else env, cwd=ROOT,
                                capture_output=True, text=True, timeout=15)
        self.assertNotIn(CANARY, result.stdout + result.stderr)
        return result

    def cli(self, mode="verify", component="api", sha=SHA, reference=None, container_id=None):
        args = [sys.executable, str(VERIFIER), mode, component, sha,
                reference if reference is not None else REFS.get(component, "invalid")]
        if container_id is not None:
            args.append(container_id)
        return self.execute(args)

    def calls(self):
        return [json.loads(line) for line in self.log.read_text().splitlines()] if self.log.exists() else []

    def reject(self, result, error):
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "")
        self.assertEqual(result.stderr, error + "\n")

    def test_all_canonical_components_emit_only_safe_image_identity(self):
        for component in REPOS:
            result = self.cli(component=component)
            self.assertEqual(result.returncode, 0, result.stderr)
            record = json.loads(result.stdout)
            self.assertEqual(record["imageReference"], REFS[component])
            self.assertEqual(record["sourceCommit"], SHA)
            self.assertEqual(record["classification"], "IMAGE_IDENTITY_VERIFIED_NOT_DEPLOYMENT")
            self.assertNotIn("Config", record)

    def test_resolves_sha_tag_then_verifies_digest_identity(self):
        discovery = REPOS["api"] + ":sha-" + SHA[:7]
        result = self.cli("resolve", reference=discovery)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, REFS["api"] + "\n")
        self.assertEqual(self.calls(), [["image", "inspect", discovery], ["image", "inspect", REFS["api"]]])

    def test_discovery_missing_duplicate_or_foreign_digest_is_rejected(self):
        discovery = REPOS["api"] + ":sha-" + SHA[:7]
        for digests in ([], [REFS["api"], REFS["api"]], [REFS["web"]],
                        [REFS["api"], REPOS["api"] + "@sha256:" + "f" * 64]):
            with self.subTest(digests=digests):
                self.data["images"][discovery][0]["RepoDigests"] = digests
                self.reject(self.cli("resolve", reference=discovery), "IMAGE_REGISTRY_DIGEST_AMBIGUOUS")

    def test_discovery_rejects_changed_image_between_tag_and_digest_inspection(self):
        discovery = REPOS["api"] + ":sha-" + SHA[:7]
        self.data["images"][discovery][0]["Id"] = "sha256:" + "9" * 64
        self.reject(self.cli("resolve", reference=discovery), "IMAGE_DISCOVERY_ID_CHANGED")

    def test_foreign_component_tag_and_config_digest_inputs_rejected_before_pull(self):
        for reference in [REPOS["api"] + ":sha-" + SHA[:7], REFS["web"],
                          REFS["api"].replace("pachaninm-lab", "foreign-owner"), "sha256:" + "6" * 64]:
            self.reject(self.cli("pull-verify", reference=reference), "IMAGE_REFERENCE_INVALID")
        self.assertEqual(self.calls(), [])

    def test_discovery_tag_must_match_requested_full_sha_prefix(self):
        self.reject(self.cli("resolve", reference=REPOS["api"] + ":sha-bbbbbbb"), "IMAGE_DISCOVERY_REFERENCE_INVALID")
        self.assertEqual(self.calls(), [])

    def test_invalid_sha_rejected_before_docker(self):
        self.reject(self.cli(sha="a" * 7), "IMAGE_SHA_INVALID")
        self.assertEqual(self.calls(), [])

    def test_missing_or_stale_image_revision_rejected(self):
        for revision in (None, "b" * 40):
            self.data["images"][REFS["api"]][0]["Config"]["Labels"]["org.opencontainers.image.revision"] = revision
            self.reject(self.cli(), "IMAGE_REVISION_MISMATCH")

    def test_requested_registry_digest_must_exist_in_inspected_image(self):
        self.data["images"][REFS["api"]][0]["RepoDigests"] = [REFS["web"]]
        self.reject(self.cli(), "IMAGE_REGISTRY_DIGEST_MISMATCH")

    def test_config_id_cannot_be_substituted_as_registry_digest(self):
        image = self.data["images"][REFS["api"]][0]
        forged_reference = REPOS["api"] + "@" + image["Id"]
        self.data["images"][forged_reference] = [image]
        self.reject(self.cli(reference=forged_reference), "IMAGE_REGISTRY_DIGEST_MISMATCH")

    def test_containerd_store_equal_image_id_and_registry_digest_is_valid(self):
        for component in REPOS:
            image_id = REFS[component].split("@")[1]
            discovery = REPOS[component] + ":sha-" + SHA[:7]
            self.data["images"][REFS[component]][0]["Id"] = image_id
            self.data["images"][discovery][0]["Id"] = image_id
            self.assertEqual(self.cli("resolve", component, reference=discovery).returncode, 0)
            self.assertEqual(self.cli(component=component).returncode, 0)
            if component in CID:
                self.data["containers"][CID[component]][0]["Image"] = image_id
                result = self.cli("runtime", component, container_id=CID[component])
                self.assertEqual(result.returncode, 0, result.stderr)

    def test_transport_failure_never_exposes_raw_diagnostics(self):
        del self.data["images"][REFS["api"]]
        self.reject(self.cli(), "IMAGE_TRANSPORT_FAILED")

    def test_malformed_inspection_is_sanitized(self):
        for raw in ("{" + CANARY, [], [{}, {}]):
            self.data["images"][REFS["api"]] = raw
            self.reject(self.cli(), "IMAGE_INSPECTION_INVALID")

    def test_failed_pull_cannot_continue_to_inspect(self):
        self.data["pullStatus"] = 23
        self.reject(self.cli("pull-verify"), "IMAGE_TRANSPORT_FAILED")
        self.assertEqual(self.calls(), [["pull", REFS["api"]]])

    def test_runtime_accepts_bound_immutable_running_image(self):
        for component in CID:
            result = self.cli("runtime", component=component, container_id=CID[component])
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(result.stdout, SHA + "\n")

    def test_target_container_label_does_not_hide_an_old_image(self):
        self.data["containers"][CID["api"]][0]["Image"] = "sha256:" + "9" * 64
        self.reject(self.cli("runtime", container_id=CID["api"]), "RUNTIME_IMAGE_ID_MISMATCH")

    def test_actual_image_revision_cannot_be_overridden_by_container_label(self):
        self.data["images"][REFS["api"]][0]["Config"]["Labels"]["org.opencontainers.image.revision"] = "b" * 40
        self.reject(self.cli("runtime", container_id=CID["api"]), "IMAGE_REVISION_MISMATCH")

    def test_runtime_requires_persisted_immutable_reference(self):
        self.data["containers"][CID["api"]][0]["Config"]["Image"] = REPOS["api"] + ":sha-" + SHA[:7]
        self.reject(self.cli("runtime", container_id=CID["api"]), "RUNTIME_IMAGE_REFERENCE_MISMATCH")

    def test_stopped_runtime_is_rejected(self):
        self.data["containers"][CID["api"]][0]["State"]["Running"] = False
        self.reject(self.cli("runtime", container_id=CID["api"]), "RUNTIME_NOT_RUNNING")

    def test_runtime_rejects_wrong_or_abbreviated_container_identity(self):
        self.reject(self.cli("runtime", container_id="1" * 12), "RUNTIME_CONTAINER_ID_INVALID")
        self.assertEqual(self.calls(), [])
        self.data["containers"][CID["api"]][0]["Id"] = CID["web"]
        self.reject(self.cli("runtime", container_id=CID["api"]), "RUNTIME_CONTAINER_ID_MISMATCH")

    def test_workflow_discovery_exports_digest_refs_and_safe_artifacts(self):
        evidence = self.root / "evidence"
        output = self.root / "workflow-outputs"
        env = dict(self.env, GH_TOKEN="synthetic-token", GITHUB_ACTOR="synthetic-actor",
                   SHORT_SHA=SHA[:7], EVIDENCE_DIR=str(evidence), GITHUB_OUTPUT=str(output))
        source = WORKFLOW.read_text()
        step = source[:source.index('      - name: Resolve protected key and pinned VPS identity')]
        name = step.rsplit('      - name: ', 1)[1].split('\n', 1)[0]
        result = self.execute(["bash", "-c", shell_step(name)], env)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(output.read_text().splitlines(), [component.replace("-", "_") + "_image=" + REFS[component] for component in REPOS])
        for component in REPOS:
            raw = (evidence / (component + "-image.json")).read_text()
            self.assertNotIn(CANARY, raw)
            self.assertEqual(json.loads(raw)["imageReference"], REFS[component])

    def executor_functions(self):
        source = EXECUTOR.read_text()
        fail = source[source.index("fail() {"):source.index("decode() {")]
        verify = source[source.index("verify_image() {"):source.index("wait_api() {")]
        broker = source[source.index("verify_broker_image() {"):source.index("resolve_outbox_runtime_env_file() {")]
        return "set -Eeuo pipefail\n" + fail + verify + broker

    def test_actual_executor_preflight_checks_all_four_images(self):
        source = EXECUTOR.read_text()
        preflight = source[source.index('[[ -n "$API_IMAGE" &&'):source.index('# Shared release-authority root:')]
        result = self.execute(["bash", "-c", self.executor_functions() + preflight + '\nprintf "PREFLIGHT_DONE\\n"\n'])
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "PREFLIGHT_DONE\n")
        self.assertEqual([args for args in self.calls() if args[0] == "pull"], [["pull", ref] for ref in REFS.values()] + [["pull", KAFKA_IMAGE]])

    def test_actual_executor_rejects_migration_substitution_before_next_stage(self):
        source = EXECUTOR.read_text()
        preflight = source[source.index('[[ -n "$API_IMAGE" &&'):source.index('# Shared release-authority root:')]
        env = dict(self.env, MIGRATION_IMAGE=REFS["api"])
        result = self.execute(["bash", "-c", self.executor_functions() + preflight + '\nprintf "PREFLIGHT_DONE\\n"\n'], env)
        self.assertEqual(result.returncode, 20)
        self.assertEqual(result.stderr, "ERROR_CODE=IMAGE_BINDING_FAILED\n")
        self.assertNotIn("PREFLIGHT_DONE", result.stdout)

    def final_verification(self):
        source = EXECUTOR.read_text()
        final = source[source.rindex('new_api_id="$("${dc_target[@]}" ps -q api | head -1)"'):]
        return (self.executor_functions() + '\ndc_target=(docker compose)\nRELEASE_ROLLBACK_ARMED=1\n'
                'rollback_and_exit() { printf "ROLLBACK_INVOKED\\n" >&2; exit "$1"; }\n' + final)

    def test_actual_executor_success_requires_all_runtime_bindings(self):
        result = self.execute(["bash", "-c", self.final_verification()])
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("DEPLOYMENT_COMPLETE=1\n", result.stdout)
        self.assertEqual([args[-1] for args in self.calls() if args[:2] == ["container", "inspect"]], list(CID.values()))

    def test_actual_executor_binding_failure_enters_existing_rollback_flow(self):
        self.data["containers"][CID["web"]][0]["Image"] = "sha256:" + "9" * 64
        result = self.execute(["bash", "-c", self.final_verification()])
        self.assertEqual(result.returncode, 83)
        self.assertIn("ERROR_CODE=RUNNING_WEB_IMAGE_BINDING_FAILED", result.stderr)
        self.assertIn("ROLLBACK_INVOKED", result.stderr)
        self.assertNotIn("DEPLOYMENT_COMPLETE=1", result.stdout)


if __name__ == "__main__":
    unittest.main(verbosity=2)
