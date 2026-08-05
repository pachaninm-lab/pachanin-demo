/**
 * The single semantic correction this pack carries.
 *
 * `js/insufficient-password-hash` exists because a password is low-entropy: an
 * attacker who obtains a cheap digest of one can enumerate the small space of
 * plausible secrets. Everything the rule does follows from that premise.
 *
 * The premise does not hold for an opaque bearer credential. A value drawn from
 * a CSPRNG with 128 bits or more of entropy has no enumerable space, so no
 * digest cost bounds a search of it. For such a value a deterministic keyed
 * digest is the correct storage form, and a deliberately slow KDF would add
 * latency and a denial-of-service surface while adding no protection.
 *
 * What makes the rule misfire on such code is its source heuristic: a call is
 * treated as yielding a password when its *name* suggests one. A token issuer
 * whose name happens to contain the word mints its result from a CSPRNG, yet
 * every value it returns is taken for a password on the strength of the name
 * alone.
 *
 * This file states the correction and nothing else. It names no file, no path,
 * no function and no finding. A digest site is exempt only when *every*
 * password source that reaches it is a call whose callee demonstrably returns
 * CSPRNG material — so a genuine password reaching the same site, including one
 * concatenated with a random salt, is still reported.
 */

import javascript
private import semmle.javascript.security.dataflow.InsufficientPasswordHashCustomizations

/** 128 bits: the floor below which a digest's cost would start to matter. */
private int minimumEntropyBytes() { result = 16 }

/** A call to a cryptographically secure random generator. */
private predicate isCsprngOutput(DataFlow::Node node) {
  exists(DataFlow::CallNode call |
    call =
      DataFlow::moduleMember(["crypto", "node:crypto"], ["randomBytes", "randomFillSync"])
          .getACall() and
    call.getArgument(0).getIntValue() >= minimumEntropyBytes() and
    node = call
  )
  or
  exists(DataFlow::CallNode call |
    call = DataFlow::moduleMember(["crypto", "node:crypto"], "randomUUID").getACall() and
    node = call
  )
}

/**
 * Flow from a CSPRNG call to a value a function hands back.
 *
 * Taint tracking is used rather than a hand-written step relation because the
 * shapes that carry a token are open-ended — `String(raw ?? '')`, a template,
 * `[version, purpose, token].join(sep)`, a property of a returned object, a
 * parameter of a helper two modules away. An earlier version of this file
 * enumerated those steps and missed the ones the product actually uses.
 */
private module MintConfig implements DataFlow::ConfigSig {
  predicate isSource(DataFlow::Node node) { isCsprngOutput(node) }

  predicate isSink(DataFlow::Node node) { node = any(Function f).getAReturnedExpr().flow() }
}

private module MintFlow = TaintTracking::Global<MintConfig>;

/**
 * A call whose callee returns CSPRNG material: a minting call.
 *
 * The value such a call yields is a freshly drawn credential regardless of what
 * the function is named, which is exactly the evidence the name heuristic lacks.
 */
private predicate mintedCredentialCall(DataFlow::Node node) {
  exists(DataFlow::CallNode call, Function callee |
    node = call and
    callee = call.getACallee() and
    MintFlow::flowTo(callee.getAReturnedExpr().flow())
  )
}

/**
 * Upstream's own source-to-sink relation, computed without this file's barrier.
 *
 * The barrier has to ask which sources reach a digest site, and it cannot ask
 * the corrected query that question without defining itself in terms of itself.
 * This is that same relation, stated once, free of the correction.
 */
private module PlainPasswordConfig implements DataFlow::ConfigSig {
  predicate isSource(DataFlow::Node node) { node instanceof InsufficientPasswordHash::Source }

  predicate isSink(DataFlow::Node node) { node instanceof InsufficientPasswordHash::Sink }

  predicate isBarrier(DataFlow::Node node) { node instanceof InsufficientPasswordHash::Sanitizer }
}

private module PlainPasswordFlow = TaintTracking::Global<PlainPasswordConfig>;

/**
 * A digest site fed only by minted credentials.
 *
 * `forall` is what keeps this from concealing a defect: one ordinary password
 * arriving at the same site — a parameter, a request field, a password mixed
 * with a random salt — leaves the site reported exactly as upstream reports it.
 */
class OpaqueCredentialBarrier extends DataFlow::Node {
  OpaqueCredentialBarrier() {
    this instanceof InsufficientPasswordHash::Sink and
    exists(DataFlow::Node source | PlainPasswordFlow::flow(source, this)) and
    forall(DataFlow::Node source | PlainPasswordFlow::flow(source, this) |
      mintedCredentialCall(source)
    )
  }
}
