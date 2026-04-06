# Source transfer status

## What is already in the repository
The repository already contains:
- project baseline and branch model;
- root monorepo bootstrap files;
- workspace skeleton for `apps/api`, `apps/web`, `packages/domain-core`;
- hardening modules for the 14-problem contour;
- integration and readiness documentation;
- verification scripts for repository contour and hardening.

## What is not yet fully transferred as individual Git files
The local working copy contains a much larger source set than the current Git branch.
The remaining transfer scope includes the full project source tree and supporting technical assets such as:
- full `apps/api` tree;
- full `apps/web` tree;
- full `packages` tree;
- full `scripts` tree;
- full `shared` tree;
- full `config`, `infra`, `integrations`, `types` trees;
- workflow files and technical API spec.

## Why the transfer is not yet complete
The current GitHub connector supports file creation and repository edits, but it does not provide a direct local-folder bulk import operation.
This means the remaining source has to be ported either:
1. file-by-file / tree-by-tree through the connector, or
2. through a native Git push from a machine with repository credentials.

## Current best state
- the repository is already established as the project repo;
- the engineering baseline is present;
- the hardening contour is present;
- the remaining task is a mechanical full-source import, not conceptual design work.

## Recommended completion path
The fastest completion path is a native Git push of the prepared local working tree into this repository.
If work continues through the connector only, the remaining source should be ported in batches by directory.
