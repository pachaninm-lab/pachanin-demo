/**
 * The single semantic correction this pack carries.
 *
 * `js/insufficient-password-hash` exists because a password is low-entropy: an
 * attacker who obtains a cheap digest of one can enumerate the small space of
 * plausible secrets. Everything the rule does follows from that premise.
 *
 * The premise does not hold for an opaque bearer credential. A value drawn from
 * a CSPRNG with 256 bits or more of entropy has no enumerable space, so no
 * digest cost bounds a search of it. For such a value a deterministic keyed
 * digest is the correct storage form, and a deliberately slow KDF would add
 * latency and a denial-of-service surface while adding no protection.
 *
 * What makes the rule misfire is its source heuristic: a call is treated as
 * yielding a password when its *name* suggests one. A token issuer whose name
 * happens to contain the word mints its result from a CSPRNG, yet every value
 * it returns is taken for a password on the strength of the name alone.
 *
 * A digest site is exempt only when the whole chain below holds. Any one
 * conjunct failing leaves the site reported exactly as upstream reports it:
 *
 *   1. credential material of at least the minimum width reaches the digest,
 *      established by interprocedural taint from the CSPRNG draw itself, so
 *      argument-to-parameter, return-to-caller, `x ?? ''`, `String(x)`, array
 *      elements, `join`, aliases and property read/write are all covered by
 *      the engine rather than by a hand-written list of shapes;
 *   2. every password-classified source reaching the digest is that same
 *      material, so one ordinary password arriving at the same site — on its
 *      own or mixed with a token — keeps the site reported;
 *   3. the digest is a keyed HMAC, not a bare hash;
 *   4. the key is neither the token nor a password;
 *   5. the pre-image is assembled with at least two label operands that carry
 *      neither credential material, nor password material, nor remote input —
 *      domain separation, together with a purpose and a version that an
 *      attacker cannot choose.
 *
 * This file names no file, no path, no function, no purpose string and no
 * finding. Every condition is a property of the program.
 *
 * One condition the owner requires is deliberately *not* asserted here: that
 * the raw token never reaches the database or the audit log. That is a
 * statement about sinks this query does not model, and faking it in QL would
 * make the barrier look stronger than it is. It is enforced separately, by the
 * credential-boundary specs in the auth module.
 */

import javascript
private import semmle.javascript.security.dataflow.InsufficientPasswordHashCustomizations
private import semmle.javascript.security.dataflow.RemoteFlowSources

/** 256 bits: the authority's minimum credential width. */
private int minimumEntropyBytes() { result = 32 }

/** A call to a cryptographically secure random generator of sufficient width. */
private predicate isCsprngOutput(DataFlow::Node node) {
  exists(DataFlow::CallNode call |
    call =
      DataFlow::moduleMember(["crypto", "node:crypto"], ["randomBytes", "randomFillSync"])
          .getACall() and
    call.getArgument(0).getIntValue() >= minimumEntropyBytes() and
    node = call
  )
}

/** The pre-image argument of a keyed HMAC. */
private class KeyedHmacDigest extends DataFlow::Node {
  private DataFlow::CallNode hmac;

  KeyedHmacDigest() {
    hmac = DataFlow::moduleMember(["crypto", "node:crypto"], "createHmac").getACall() and
    this = hmac.getAMethodCall("update").getArgument(0)
  }

  /** The keying material this digest was constructed with. */
  DataFlow::Node getKey() { result = hmac.getArgument(1) }
}

/** An element of an array that is joined into a single string. */
private predicate joinedElement(DataFlow::MethodCallNode join, DataFlow::Node element) {
  exists(DataFlow::ArrayCreationNode parts |
    join.getMethodName() = "join" and
    parts = join.getReceiver().getALocalSource() and
    element = parts.getAnElement()
  )
}

/**
 * The nodes any of the flows below need an answer about.
 *
 * Declaring them rather than tracking to every node in the program keeps three
 * global analyses affordable.
 */
private class RelevantNode extends DataFlow::Node {
  RelevantNode() {
    this instanceof InsufficientPasswordHash::Source or
    this instanceof InsufficientPasswordHash::Sink or
    this instanceof KeyedHmacDigest or
    exists(KeyedHmacDigest digest | this = digest.getKey()) or
    joinedElement(_, this)
  }
}

/** Where credential material drawn from a CSPRNG ends up. */
private module OpaqueConfig implements DataFlow::ConfigSig {
  predicate isSource(DataFlow::Node node) { isCsprngOutput(node) }

  predicate isSink(DataFlow::Node node) { node instanceof RelevantNode }
}

private module OpaqueFlow = TaintTracking::Global<OpaqueConfig>;

/**
 * Upstream's own source-to-sink relation, computed without this file's barrier.
 *
 * The barrier has to ask which sources reach a digest site, and it cannot ask
 * the corrected query that question without defining itself in terms of itself.
 */
private module PasswordConfig implements DataFlow::ConfigSig {
  predicate isSource(DataFlow::Node node) { node instanceof InsufficientPasswordHash::Source }

  predicate isSink(DataFlow::Node node) { node instanceof RelevantNode }

  predicate isBarrier(DataFlow::Node node) { node instanceof InsufficientPasswordHash::Sanitizer }
}

private module PasswordFlow = TaintTracking::Global<PasswordConfig>;

/**
 * A function that draws credential material, directly or through what it calls.
 *
 * This is asked of a *callee*, not of a value, because the name heuristic fires
 * on a call whose result is an object with the token inside it. Taint reaching
 * that object carries the credential in content, so asking whether the call
 * node itself is tainted answers no even when the call plainly mints one.
 */
private predicate drawsCredentialMaterial(Function callee) {
  exists(DataFlow::Node draw | isCsprngOutput(draw) and draw.getContainer() = callee)
  or
  exists(DataFlow::CallNode inner |
    inner.getContainer() = callee and drawsCredentialMaterial(inner.getACallee())
  )
}

/** A call that yields freshly minted credential material. */
private predicate isMintingCall(DataFlow::Node node) {
  exists(DataFlow::CallNode call |
    node = call and drawsCredentialMaterial(call.getACallee())
  )
}

/** Where attacker-controlled input ends up. */
private module RemoteConfig implements DataFlow::ConfigSig {
  predicate isSource(DataFlow::Node node) { node instanceof RemoteFlowSource }

  predicate isSink(DataFlow::Node node) { node instanceof RelevantNode }
}

private module RemoteFlow = TaintTracking::Global<RemoteConfig>;

/**
 * A fixed label in a digest pre-image: a purpose, a version, a separator.
 *
 * Fixed is stated negatively and structurally — the operand carries no
 * credential material, no password material and nothing an attacker supplies —
 * because the positive form, "a member of this enum", cannot be written without
 * naming the enum, and naming it would tie the correction to one repository.
 */
private predicate isFixedLabel(DataFlow::Node node) {
  not OpaqueFlow::flowTo(node) and
  not PasswordFlow::flowTo(node) and
  not RemoteFlow::flowTo(node)
}

/** A pre-image carrying domain separation: at least two fixed labels. */
private predicate isDomainSeparated(DataFlow::Node preimage) {
  exists(DataFlow::MethodCallNode join |
    join.flowsTo(preimage) and
    count(DataFlow::Node label | joinedElement(join, label) and isFixedLabel(label)) >= 2
  )
}

/** A digest site fed only by minted credentials, under a keyed authority. */
class OpaqueCredentialBarrier extends DataFlow::Node {
  OpaqueCredentialBarrier() {
    exists(KeyedHmacDigest digest |
      this = digest and
      OpaqueFlow::flowTo(this) and
      exists(DataFlow::Node source | PasswordFlow::flow(source, this)) and
      forall(DataFlow::Node source | PasswordFlow::flow(source, this) |
        isMintingCall(source)
      ) and
      // The key must not be the credential it protects. An independently drawn
      // random key is exactly right, so this asks whether one draw feeds both
      // the key and the pre-image, not whether the key is random.
      not exists(DataFlow::Node draw |
        OpaqueFlow::flow(draw, digest.getKey()) and OpaqueFlow::flow(draw, this)
      ) and
      not PasswordFlow::flowTo(digest.getKey()) and
      isDomainSeparated(this)
    )
  }
}
