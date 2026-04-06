#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
cat full_source_code.tar.gz.b64.part-* > full_source_code.tar.gz.b64
base64 -d full_source_code.tar.gz.b64 > full_source_code.tar.gz
sha256sum full_source_code.tar.gz
mkdir -p extracted
cd extracted
rm -rf ./*
tar -xzf ../full_source_code.tar.gz
printf "Reconstructed into %s\n" "$(pwd)"
