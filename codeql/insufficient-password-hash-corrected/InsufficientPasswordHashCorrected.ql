/**
 * @name Use of password hash with insufficient computational effort
 * @description Creating a hash of a password with low computational effort makes the hash vulnerable to password cracking attacks.
 * @kind path-problem
 * @problem.severity warning
 * @security-severity 8.1
 * @precision high
 * @id js/insufficient-password-hash-opaque-credential-aware
 * @tags security
 *       external/cwe/cwe-916
 */

/*
 * One-for-one replacement for `js/insufficient-password-hash`.
 *
 * Derived from the upstream query at codeql-cli/v2.26.4,
 * javascript/ql/src/Security/CWE-916/InsufficientPasswordHash.ql, together with
 * its flow configuration at
 * javascript/ql/lib/semmle/javascript/security/dataflow/InsufficientPasswordHashQuery.qll.
 * Provenance is pinned in upstream.lock.json and enforced by the drift check.
 *
 * Everything is inherited rather than restated: `Source`, `Sink` and
 * `Sanitizer` come from the upstream customizations module, the select clause
 * and every metadata field are byte-identical to upstream, and CWE-916,
 * severity 8.1, precision high and the security tag are unchanged. Only the
 * `@id` differs, because two rules may not share one identifier.
 *
 * The single semantic difference is one added disjunct in `isBarrier`: a value
 * carrying full CSPRNG entropy is not a password. See OpaqueCredentialBarrier.qll
 * for why that follows from the rule's own premise rather than from convenience.
 */

import javascript
import semmle.javascript.security.dataflow.InsufficientPasswordHashCustomizations::InsufficientPasswordHash
import OpaqueCredentialBarrier

module CorrectedInsufficientPasswordHashConfig implements DataFlow::ConfigSig {
  predicate isSource(DataFlow::Node source) { source instanceof Source }

  predicate isSink(DataFlow::Node sink) { sink instanceof Sink }

  predicate isBarrier(DataFlow::Node node) {
    // Upstream barrier, unchanged.
    node instanceof Sanitizer
    or
    // The correction.
    node instanceof OpaqueCredentialBarrier
  }

  predicate observeDiffInformedIncrementalMode() { any() }
}

module CorrectedInsufficientPasswordHashFlow =
  TaintTracking::Global<CorrectedInsufficientPasswordHashConfig>;

import CorrectedInsufficientPasswordHashFlow::PathGraph

from
  CorrectedInsufficientPasswordHashFlow::PathNode source,
  CorrectedInsufficientPasswordHashFlow::PathNode sink
where CorrectedInsufficientPasswordHashFlow::flowPath(source, sink)
select sink.getNode(), source, sink, "Password from $@ is hashed insecurely.", source.getNode(),
  source.getNode().(Source).describe()
