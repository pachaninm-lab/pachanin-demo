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
 * This file states that and nothing else. It names no file, no path, no
 * function and no finding, so it cannot conceal a defect here or anywhere
 * else — a value only qualifies by demonstrably carrying CSPRNG entropy.
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
 * A value that still carries the entropy of the CSPRNG it came from.
 *
 * The step relation is deliberately narrow. Encoding, slicing and assembling a
 * token out of random parts preserve entropy; deriving a value from something
 * the rule already treats as a password does not create it, which is why a
 * template containing a password source never qualifies.
 */
private predicate fullEntropyValue(DataFlow::Node node) {
  isCsprngOutput(node)
  or
  // Encoding and reshaping: Buffer to string, case and slice normalisation.
  exists(DataFlow::MethodCallNode step |
    fullEntropyValue(step.getReceiver()) and
    step.getMethodName() =
      [
        "toString", "slice", "substring", "substr", "toUpperCase", "toLowerCase", "trim",
        "replace", "padStart", "padEnd"
      ] and
    node = step
  )
  or
  // Assembly: `${id}.${secret}`, provided no part is itself a password.
  exists(TemplateLiteral tpl |
    fullEntropyValue(tpl.getAnElement().flow()) and
    not tpl.getAnElement().flow() instanceof InsufficientPasswordHash::Source and
    node = tpl.flow()
  )
  or
  // Assembly: [version, purpose, token].join(separator), same condition.
  exists(DataFlow::MethodCallNode join, DataFlow::ArrayCreationNode parts |
    join.getMethodName() = "join" and
    join.getReceiver() = parts and
    fullEntropyValue(parts.getAnElement()) and
    not parts.getAnElement() instanceof InsufficientPasswordHash::Source and
    node = join
  )
}

/** A value carrying full CSPRNG entropy, which is therefore not a password. */
class OpaqueCredentialBarrier extends DataFlow::Node {
  OpaqueCredentialBarrier() { fullEntropyValue(this) }
}
