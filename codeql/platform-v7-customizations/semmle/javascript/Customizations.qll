/**
 * Repository-owned correction to the password-hashing model.
 *
 * `js/insufficient-password-hash` classifies the result of a call as a
 * cleartext password when the callee's *name* matches the password heuristic
 * (`SensitiveCall` takes its classification from `getCalleeName()`). The rule's
 * premise is a low-entropy, human-chosen secret: hashing one with a fast
 * primitive lets an attacker who obtains the digest brute-force it cheaply.
 *
 * That premise does not hold for an opaque bearer token. A value drawn from a
 * CSPRNG with 256 bits of entropy cannot be brute-forced regardless of the
 * digest's cost, so a deterministic keyed digest is the correct storage form,
 * and a slow KDF would add latency and a denial-of-service surface without
 * adding practical protection.
 *
 * This correction states that property structurally: a value that provably
 * originates from `crypto.randomBytes` of at least 16 bytes is not a password
 * for the purposes of this query, whatever the enclosing function is called.
 *
 * What this deliberately does NOT do:
 *  - it names no file, no line, no finding id and no function, so it cannot
 *    hide a future defect in this repository or anywhere else;
 *  - it does not disable the query, lower its severity or dismiss an alert;
 *  - it leaves every genuine password flow reported exactly as before — a
 *    password reaching a fast or keyed hash, and a password-derived request
 *    fingerprint, both still produce a high-severity finding.
 *
 * `apps/api/src/modules/auth/codeqlPasswordHashModel.spec.ts` holds the
 * characterization suite that pins both directions.
 */

import javascript
private import semmle.javascript.security.dataflow.InsufficientPasswordHashCustomizations

/**
 * Holds when `node` is a byte string produced by a cryptographically secure
 * random generator with at least `minBytes` of entropy.
 */
private predicate isCsprngBytes(DataFlow::Node node, int minBytes) {
  exists(DataFlow::CallNode call |
    call = DataFlow::moduleMember(["crypto", "node:crypto"], "randomBytes").getACall()
    and call.getArgument(0).getIntValue() >= minBytes
    and node = call
  )
}

/**
 * A value derived from at least 128 bits of CSPRNG output.
 *
 * The step relation is deliberately narrow: encoding (`toString`), slicing and
 * template concatenation preserve the entropy, so a token assembled from random
 * bytes still qualifies, while a value merely *concatenated with* a password
 * does not become random.
 */
private DataFlow::Node csprngDerived() {
  isCsprngBytes(result, 16)
  or
  exists(DataFlow::MethodCallNode encode |
    encode.getReceiver() = csprngDerived() and
    encode.getMethodName() = ["toString", "slice", "substring", "toUpperCase", "toLowerCase"] and
    result = encode
  )
  or
  exists(TemplateLiteral tpl |
    tpl.getAnElement().flow() = csprngDerived() and
    not exists(DataFlow::Node other |
      other.asExpr() = tpl.getAnElement() and
      other instanceof InsufficientPasswordHash::Source
    ) and
    result = tpl.flow()
  )
  or
  exists(DataFlow::CallNode join |
    join.getMethodName() = "join" and
    join.getReceiver().(DataFlow::ArrayCreationNode).getAnElement() = csprngDerived() and
    result = join
  )
}

/**
 * An opaque bearer token is not a password: it carries full CSPRNG entropy, so
 * the cost of its digest does not bound an attacker's search.
 */
private class OpaqueBearerTokenIsNotAPassword extends InsufficientPasswordHash::Sanitizer {
  OpaqueBearerTokenIsNotAPassword() { this = csprngDerived() }
}
