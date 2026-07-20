# Controlled llama.cpp source build — release b9637

## Boundary

This runbook produces external build evidence for the exact authority in `llama-cpp-toolchain-authority.v1.json`. It does not build or admit a model, does not change the committed `PENDING_BUILD` baseline, and does not make a production-readiness claim.

The controlled profile is Linux x86_64, CPU-only, Release, static libraries, Ninja, `GGML_NATIVE=OFF`, embedded UI disabled and no prebuilt UI download. The required outputs are exactly:

- `llama-cli`;
- `llama-server`;
- `llama-quantize`;
- `llama-bench`.

## 1. Prepare an isolated evidence root

Use a fresh root on a controlled host. Do not reuse an earlier checkout or build directory.

```bash
set -euo pipefail
umask 077

export TAI_REPO=/srv/transparent-price
export EVIDENCE_ROOT=/secure/evidence/llama-cpp-b9637
export LLAMA_REPOSITORY=https://github.com/ggml-org/llama.cpp
export LLAMA_RELEASE=b9637
export LLAMA_COMMIT=aedb2a5e9ca3d4064148bbb919e0ddc0c1b70ab3
export LLAMA_ARCHIVE_URI="https://github.com/ggml-org/llama.cpp/archive/${LLAMA_COMMIT}.tar.gz"
export LLAMA_ARCHIVE_PATH="${EVIDENCE_ROOT}/source/llama.cpp-${LLAMA_COMMIT}.tar.gz"

command -v git
command -v curl
command -v cmake
command -v ninja
command -v cc
command -v c++
command -v sha256sum

test ! -e "${EVIDENCE_ROOT}"
mkdir -p "${EVIDENCE_ROOT}/source" "${EVIDENCE_ROOT}/build" "${EVIDENCE_ROOT}/evidence"
```

Record host provisioning and operator identity in the external change record. Do not put credentials or tokens in the evidence root.

## 2. Capture the exact source archive

```bash
curl --fail --location --proto '=https' --tlsv1.2 \
  "${LLAMA_ARCHIVE_URI}" \
  --output "${LLAMA_ARCHIVE_PATH}"

test -s "${LLAMA_ARCHIVE_PATH}"
sha256sum "${LLAMA_ARCHIVE_PATH}"
stat --format='%s' "${LLAMA_ARCHIVE_PATH}"
```

The collector records the archive size and SHA-256. The URI is commit-bound by authority; a release-tag archive, branch archive or short SHA is invalid.

## 3. Create a detached exact-commit checkout

```bash
git init "${EVIDENCE_ROOT}/source/llama.cpp"
git -C "${EVIDENCE_ROOT}/source/llama.cpp" remote add origin "${LLAMA_REPOSITORY}"
git -C "${EVIDENCE_ROOT}/source/llama.cpp" fetch --depth 1 origin "${LLAMA_COMMIT}"
git -C "${EVIDENCE_ROOT}/source/llama.cpp" checkout --detach "${LLAMA_COMMIT}"

git -C "${EVIDENCE_ROOT}/source/llama.cpp" rev-parse HEAD \
  > "${EVIDENCE_ROOT}/evidence/git-head.txt"
git -C "${EVIDENCE_ROOT}/source/llama.cpp" status \
  --porcelain=v1 --untracked-files=all \
  > "${EVIDENCE_ROOT}/evidence/git-status.txt"

test "$(cat "${EVIDENCE_ROOT}/evidence/git-head.txt")" = "${LLAMA_COMMIT}"
test ! -s "${EVIDENCE_ROOT}/evidence/git-status.txt"
```

The build directory is deliberately outside the checkout so the checkout can remain clean. Do not patch the source tree. If a patch is required, create a new governed authority instead of editing this evidence.

## 4. Capture CMake and compiler identities

```bash
cmake --version > "${EVIDENCE_ROOT}/evidence/cmake-version.txt"
cc --version > "${EVIDENCE_ROOT}/evidence/cc-version.txt"
c++ --version > "${EVIDENCE_ROOT}/evidence/cxx-version.txt"

test -s "${EVIDENCE_ROOT}/evidence/cmake-version.txt"
test -s "${EVIDENCE_ROOT}/evidence/cc-version.txt"
test -s "${EVIDENCE_ROOT}/evidence/cxx-version.txt"
```

Use the same `cc` and `c++` resolved here for CMake configuration. Record their resolved executable paths for the collector.

## 5. Run the exact configure command

Run from the evidence root. The argv below must match the authority exactly; shell redirection is only log capture and is not part of argv.

```bash
cd "${EVIDENCE_ROOT}"

cmake \
  -S source/llama.cpp \
  -B build/llama.cpp-b9637 \
  -G Ninja \
  -DCMAKE_BUILD_TYPE=Release \
  -DBUILD_SHARED_LIBS=OFF \
  -DLLAMA_BUILD_COMMON=ON \
  -DLLAMA_BUILD_TESTS=OFF \
  -DLLAMA_BUILD_EXAMPLES=OFF \
  -DLLAMA_BUILD_TOOLS=ON \
  -DLLAMA_BUILD_SERVER=ON \
  -DLLAMA_BUILD_APP=OFF \
  -DLLAMA_BUILD_UI=OFF \
  -DLLAMA_USE_PREBUILT_UI=OFF \
  -DLLAMA_TOOLS_INSTALL=OFF \
  -DLLAMA_OPENSSL=OFF \
  -DLLAMA_LLGUIDANCE=OFF \
  -DGGML_NATIVE=OFF \
  > evidence/configure.log 2>&1

test -s evidence/configure.log
test -s build/llama.cpp-b9637/CMakeCache.txt
```

A configure failure is terminal. Preserve the failed log separately, discard the build root, remediate through a reviewed authority change if needed, and restart from a fresh root.

## 6. Build exactly four targets

```bash
cmake \
  --build build/llama.cpp-b9637 \
  --config Release \
  --target \
  llama-cli \
  llama-server \
  llama-quantize \
  llama-bench \
  --parallel 2 \
  > evidence/build.log 2>&1

test -s evidence/build.log
```

Check that each output is a non-symlink regular file:

```bash
for binary in \
  build/llama.cpp-b9637/bin/llama-cli \
  build/llama.cpp-b9637/bin/llama-server \
  build/llama.cpp-b9637/bin/llama-quantize \
  build/llama.cpp-b9637/bin/llama-bench
do
  test -f "${binary}"
  test ! -L "${binary}"
  stat --format='%n %s' "${binary}"
  sha256sum "${binary}"
done
```

## 7. Reconfirm source cleanliness

The build is out-of-tree, so the exact checkout must still be clean.

```bash
git -C source/llama.cpp rev-parse HEAD \
  > evidence/git-head.txt
git -C source/llama.cpp status --porcelain=v1 --untracked-files=all \
  > evidence/git-status.txt

test "$(cat evidence/git-head.txt)" = "${LLAMA_COMMIT}"
test ! -s evidence/git-status.txt
```

Optionally inspect the deterministic source-tree digest before collection:

```bash
cd "${TAI_REPO}/apps/tai"
python -m tai.model_artifact_registry_cli hash-source-tree \
  "${EVIDENCE_ROOT}/source/llama.cpp"
```

The digest excludes `.git`, includes regular-file sizes and SHA-256 values, records symlink targets without following them, and rejects special files.

## 8. Collect and verify the machine-readable evidence

```bash
cd "${TAI_REPO}/apps/tai"

python -m tai.model_artifact_registry_cli collect-toolchain-evidence \
  model-artifacts/llama-cpp-toolchain-authority.v1.json \
  "${EVIDENCE_ROOT}" \
  --cmake-executable "$(command -v cmake)" \
  --c-compiler-executable "$(command -v cc)" \
  --cxx-compiler-executable "$(command -v c++)" \
  --output "${EVIDENCE_ROOT}/evidence/llama-cpp-build.v1.json" \
  --verification-output "${EVIDENCE_ROOT}/evidence/llama-cpp-verification.v1.json"

python -m tai.model_artifact_registry_cli verify-toolchain \
  model-artifacts/llama-cpp-toolchain-authority.v1.json \
  "${EVIDENCE_ROOT}/evidence/llama-cpp-build.v1.json" \
  "${EVIDENCE_ROOT}" \
  --output "${EVIDENCE_ROOT}/evidence/llama-cpp-verification.v1.json"
```

Both commands must exit `0`. The final report must be `VERIFIED`, contain no reasons and list all four targets. The verifier reads evidence only; it never executes configure, build or other argv from JSON.

## 9. Freeze external evidence

```bash
sha256sum \
  "${EVIDENCE_ROOT}/evidence/llama-cpp-build.v1.json" \
  "${EVIDENCE_ROOT}/evidence/llama-cpp-verification.v1.json"
```

Copy the complete evidence root to immutable external storage, preserving byte sizes, timestamps and access controls. Record the storage object version and manifest/report SHA-256 in the governed acceptance record. Do not commit the archive, checkout, logs or binaries to Git.

## Failure rules

The build is not accepted when any of the following is true:

- release, commit, authority digest or build profile differs;
- the checkout is dirty or lacks `.git` metadata;
- the source tree changes after capture;
- configure/build argv differs;
- OS, architecture, generator or identity evidence differs;
- any required file is missing, unreadable, a symlink or non-regular;
- any size or SHA-256 differs;
- binary target/path sets differ or binaries alias the same inode;
- the verification report is `PENDING_BUILD` or `REJECTED`;
- evidence exists only in a mutable CI workspace or is not copied to immutable storage.
