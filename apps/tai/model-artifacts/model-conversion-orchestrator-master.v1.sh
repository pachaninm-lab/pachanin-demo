#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_ROOT/model-conversion-prerequisites.v1.sh"
source "$SCRIPT_ROOT/model-conversion-artifacts.v1.sh"
source "$SCRIPT_ROOT/model-conversion-transport.v1.sh"
