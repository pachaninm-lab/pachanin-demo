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

/** Holds when `node` is output of a CSPRNG asked for at least `minBytes` bytes. */
private predicate isCsprngOutput(DataFlow::Node node, int minBytes) {
  exists(DataFlow::CallNode call |
    call =
      DataFlow::moduleMember(["crypto", "node:crypto"], ["randomBytes", "randomFillSync"])
          .getACall() and
    call.getArgument(0).getIntValue() >= minBytes and
    node = call
  )
  or
  exists(DataFlow::CallNode call |
    call = DataFlow::moduleMember(["crypto", "node:crypto"], "randomUUID").getACall() and
    minBytes = 16 and
    node = call
  )
}

/**
 * A value that still carries the entropy of the CSPRNG it came from.
 *
 * The step relation is deliberately narrow. Encoding, slicing and assembling a
 * token out of random parts preserve entropy; deriving a value from something
 * the rule already considers a password does not create it, which is why a
 * template or an array containing a `Source` never qualifies.
 */
private DataFlow::Node fullEntropyValue() {
  isCsprngOutput(result, 16)
  or
  // Encoding and reshaping: Buffer -> string, case and slice normalisation.
  exists(DataFlow::MethodCallNode step |
    step.getReceiver() = fullEntropyValue() and
    step.getMethodName() =
      ["toString", "slice", "substring", "substr", "toUpperCase", "toLowerCase", "trim",
          "replace", "padStart", "padEnd"] and
    result = step
  )
  or
  // Assembly: `${id}.${secret}`, provided no part is itself a password.
  exists(TemplateLiteral tpl |
    tpl.getAnElement().flow() = fullEntropyValue() and
    not exists(Expr part | part = tpl.getAnElement() | part.flow() instanceof PasswordLikeNode) and
    result = tpl.flow()
  )
  or
  // Assembly: [version, purpose, token].join(sep), same condition.
  exists(DataFlow::MethodCallNode join, DataFlow::ArrayCreationNode parts |
    join.getMethodName() = "join" and
    join.getReceiver() = parts and
    parts.getAnElement() = fullEntropyValue() and
    not parts.getAnElement() instanceof PasswordLikeNode and
    result = join
  )
  or
  // Field of an object literal built from a full-entropy value.
  exists(DataFlow::PropWrite write |
    write.getRhs() = fullEntropyValue() and
    result = write.getBase()
  )
}

/**
 * A node the password-hashing model already treats as a password.
 *
 * Referenced only to stop the entropy relation from laundering one: if a
 * password is concatenated with random bytes, the result is still a password.
 */
private class PasswordLikeNode extends DataFlow::Node {
  PasswordLikeNode() {
    this.(SensitiveNode).getClassification() = SensitiveDataClassification::password()
  }
}

/** A value carrying full CSPRNG entropy, which is therefore not a password. */
class OpaqueCredentialBarrier extends DataFlow::Node {
  OpaqueCredentialBarrier() { this = fullEntropyValue() }
}
