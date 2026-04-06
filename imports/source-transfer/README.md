# Full source transfer archive

This directory contains the full exported source tree of the current project working copy, packed as a gzip tar archive and split into base64 parts for transport through the GitHub connector.

## Contents
- `full_source_code.tar.gz.b64.part-001` ... `full_source_code.tar.gz.b64.part-006`
- reconstruction script
- checksums

## Raw archive checksum
- sha256(raw tar.gz): `ee5dfd7d63252fdb8e23f04521fc3335998ae2d345ef311e8f855292ca36c8cf`
- sha256(full base64 text): `62c14236abc77054472cf4ece1beda3f6ad887bfe58b81839f8db1906d720898`

## Reconstruction
```bash
cd imports/source-transfer
cat full_source_code.tar.gz.b64.part-* > full_source_code.tar.gz.b64
base64 -d full_source_code.tar.gz.b64 > full_source_code.tar.gz
sha256sum full_source_code.tar.gz
mkdir -p extracted
cd extracted
 tar -xzf ../full_source_code.tar.gz
```

## Purpose
This archive is the full source-transfer fallback to ensure that the complete local codebase is preserved inside the project repository even before every file is expanded into its final Git path individually.
