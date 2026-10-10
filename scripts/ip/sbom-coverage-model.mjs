// Coverage model for SBOM completeness.
//
// The denominator is derived from the tree, never hand-entered, and it is wrong
// in two directions if you only look for package.json and pyproject.toml:
//
//   - a component can carry third-party dependencies with no manifest at all
//     (apps/ml imports fastapi, lightgbm, numpy, pandas, psycopg2 and declares
//     none of them), so it never appears as covered or as a gap; and
//   - a manifest declaring zero dependencies has no pnpm lockfile importer,
//     which is correct rather than a gap - there is nothing to cover.
//
// Exclusions are verified, not asserted. A component may only be excluded as
// non-runtime while the conditions that make it non-runtime still hold, so
// adding a Dockerfile or a build script to an excluded component fails the gate.

export const MANIFEST_ECOSYSTEMS = new Map([
  ['package.json', 'npm'],
  ['pyproject.toml', 'python'],
  ['requirements.txt', 'python'],
  ['Pipfile', 'python'],
  ['setup.py', 'python'],
  ['setup.cfg', 'python'],
  ['go.mod', 'go'],
  ['Cargo.toml', 'rust'],
  ['pom.xml', 'maven'],
  ['build.gradle', 'gradle'],
  ['build.gradle.kts', 'gradle'],
  ['Gemfile', 'rubygems'],
  ['composer.json', 'composer'],
]);

export const COVERAGE_STATUS = Object.freeze({
  RUNTIME_COVERED: 'RUNTIME_COVERED',
  BUILD_ONLY_COVERED: 'BUILD_ONLY_COVERED',
  NOT_RUNTIME_WITH_JUSTIFICATION: 'NOT_RUNTIME_WITH_JUSTIFICATION',
  UNKNOWN: 'UNKNOWN',
});

const COVERED = new Set([
  COVERAGE_STATUS.RUNTIME_COVERED,
  COVERAGE_STATUS.BUILD_ONLY_COVERED,
  COVERAGE_STATUS.NOT_RUNTIME_WITH_JUSTIFICATION,
]);

function baseName(path) {
  const parts = String(path).split('/');
  return parts[parts.length - 1];
}

export function ecosystemFor(path) {
  const name = baseName(path);
  if (MANIFEST_ECOSYSTEMS.has(name)) return MANIFEST_ECOSYSTEMS.get(name);
  if (/^requirements(-[\w.]+)?\.txt$/u.test(name)) return 'python';
  if (/\.csproj$/u.test(name)) return 'nuget';
  return null;
}

export function isDependencyManifest(path) {
  return ecosystemFor(path) !== null;
}

export function componentOf(manifestPath) {
  const parts = String(manifestPath).split('/');
  parts.pop();
  return parts.length === 0 ? '.' : parts.join('/');
}

/**
 * A manifest that declares no dependencies in any scope has nothing to cover.
 * Treating it as a gap would demand an SBOM for an empty set.
 */
export function declaresNoDependencies(manifest) {
  if (!manifest || typeof manifest !== 'object') return false;
  const scopes = ['dependencies', 'devDependencies', 'optionalDependencies'];
  return scopes.every((scope) => Object.keys(manifest[scope] ?? {}).length === 0);
}

/**
 * Every condition must still hold for the exclusion to stand. This is the
 * difference between a justification and a note: if a Dockerfile, deployment
 * manifest or build script appears for the component, the exclusion collapses
 * and the caller is expected to fail closed.
 */
export function evaluateExclusion(conditions) {
  const checks = (conditions ?? []).map((condition) => ({
    condition: String(condition.condition),
    holds: condition.holds === true,
    evidence: String(condition.evidence ?? ''),
  }));
  return { checks, satisfied: checks.length > 0 && checks.every((check) => check.holds) };
}

export function classifyComponent(input) {
  const {
    component,
    manifest,
    ecosystem,
    dependencyBearing,
    coveringSbom,
    runtime,
    exclusion,
  } = input;

  const base = { component, manifest: manifest ?? null, ecosystem: ecosystem ?? null };

  if (!ecosystem) {
    return { ...base, status: COVERAGE_STATUS.UNKNOWN, reason: 'UNRECOGNISED_ECOSYSTEM', coveringSbom: [], justification: null };
  }

  if (!dependencyBearing) {
    return {
      ...base,
      status: COVERAGE_STATUS.RUNTIME_COVERED,
      reason: 'NO_DECLARED_DEPENDENCIES',
      coveringSbom: [],
      justification: null,
    };
  }

  if (Array.isArray(coveringSbom) && coveringSbom.length > 0) {
    return {
      ...base,
      status: runtime === false ? COVERAGE_STATUS.BUILD_ONLY_COVERED : COVERAGE_STATUS.RUNTIME_COVERED,
      reason: 'CANONICAL_SBOM_ARTIFACT',
      coveringSbom: [...coveringSbom].sort(),
      justification: null,
    };
  }

  if (exclusion) {
    const evaluated = evaluateExclusion(exclusion.conditions);
    if (!evaluated.satisfied) {
      return {
        ...base,
        status: COVERAGE_STATUS.UNKNOWN,
        reason: 'EXCLUSION_CONDITIONS_NO_LONGER_HOLD',
        coveringSbom: [],
        justification: { ...exclusion, ...evaluated },
      };
    }
    return {
      ...base,
      status: COVERAGE_STATUS.NOT_RUNTIME_WITH_JUSTIFICATION,
      reason: exclusion.reason ?? 'NOT_RUNTIME',
      coveringSbom: [],
      justification: { ...exclusion, ...evaluated },
    };
  }

  return { ...base, status: COVERAGE_STATUS.UNKNOWN, reason: 'DEPENDENCY_ROOT_WITHOUT_SBOM_OR_JUSTIFICATION', coveringSbom: [], justification: null };
}

export function summarise(records) {
  const sorted = [...records].sort((left, right) => left.component.localeCompare(right.component, 'en'));
  const total = sorted.length;
  const covered = sorted.filter((record) => COVERED.has(record.status)).length;
  const unknown = sorted.filter((record) => record.status === COVERAGE_STATUS.UNKNOWN).length;
  const uncovered = total - covered;
  const coveragePercent = total === 0 ? 0 : Number(((covered / total) * 100).toFixed(2));

  return {
    records: sorted,
    totals: {
      total,
      covered,
      uncovered,
      unknown,
      coveragePercent,
      runtimeCovered: sorted.filter((r) => r.status === COVERAGE_STATUS.RUNTIME_COVERED).length,
      buildOnlyCovered: sorted.filter((r) => r.status === COVERAGE_STATUS.BUILD_ONLY_COVERED).length,
      excludedWithJustification: sorted.filter((r) => r.status === COVERAGE_STATUS.NOT_RUNTIME_WITH_JUSTIFICATION).length,
    },
    // 100% is only reportable when nothing is uncovered and nothing is unknown.
    // A percentage alone can be rounded into looking complete; this flag cannot.
    complete: total > 0 && uncovered === 0 && unknown === 0,
  };
}
