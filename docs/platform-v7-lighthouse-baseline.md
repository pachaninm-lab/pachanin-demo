# Platform V7 Lighthouse baseline

## Purpose

This is the first Lighthouse baseline for Platform V7 controlled-pilot QA.

It does not claim production readiness. It records the target thresholds and provides a safe configuration that can be enforced more strictly after current route baselines are collected.

## Routes

The first Lighthouse baseline covers:

- `/platform-v7`
- `/platform-v7/control-tower`
- `/platform-v7/driver/field`
- `/platform-v7/bank`

## Target thresholds

- Accessibility: 95+
- Best Practices: 95+
- LCP: 2.5s or lower
- CLS: 0.1 or lower
- TBT: 200ms or lower as a CI-friendly proxy for interaction cost

## Current enforcement mode

The initial configuration uses warnings instead of hard failures.

Reason:

- The repository did not already contain a Lighthouse CI setup.
- The first step must establish a baseline without destabilizing normal CI.
- Hard thresholds should be enabled only after the first measured baselines are reviewed.

## Next step

After this baseline is merged and deploy is green:

1. Run Lighthouse on the canonical routes.
2. Record scores.
3. Decide which assertions can safely move from warn to error.
4. Keep no-regression as the first strict target.

## Non-negotiable rule

Do not lower user-facing quality to pass Lighthouse.

If a route fails, fix the actual cause: layout shift, excessive blocking work, missing accessible names, heavy first screen, or unstable loading state.
