#!/usr/bin/env bash
set -Eeuo pipefail

source scripts/release/production-like-kubernetes-build.sh
source scripts/release/production-like-kubernetes-cluster.sh
source scripts/release/production-like-kubernetes-verify.sh
