#!/usr/bin/env bash
set -Eeuo pipefail

source scripts/release/production-like-kubernetes-build.sh
node scripts/release/production-like-kubernetes-migration-runtime.mjs
source scripts/release/production-like-kubernetes-evidence-collection.sh
source scripts/release/production-like-kubernetes-cluster.sh
source scripts/release/production-like-kubernetes-pgbouncer.sh
source scripts/release/production-like-kubernetes-pgbouncer-evidence.sh
source scripts/release/production-like-kubernetes-verify.sh
