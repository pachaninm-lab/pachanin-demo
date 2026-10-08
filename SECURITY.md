# Security Policy

«Прозрачная Цена» / «ГЕКТА» — proprietary platform. Source is published in this
repository today; that is a historical fact, not a licence. See
[`LICENSE-PROPRIETARY.md`](./LICENSE-PROPRIETARY.md).

## Reporting a vulnerability

**Do not open a public issue for a security problem.** A public issue discloses
the weakness to everyone before it can be fixed.

Report privately through **GitHub's private vulnerability reporting** on this
repository: *Security* → *Report a vulnerability*. The report is visible only
to repository maintainers.

If private reporting is unavailable to you, open a public issue containing
**only** the words "security contact request" and no technical detail, and wait
to be contacted through a private channel.

### What to include

- affected component or endpoint;
- impact — what an attacker gains;
- preconditions — required role, tenant, or account state;
- minimal reproduction, without publishing working exploit code.

### What to expect

This is a small project without a staffed security team. Acknowledgement is on
a best-effort basis. There is **no bug bounty** and no monetary reward.

### Please do not

- run automated scanners against production (`процент-агро.рф`);
- attempt denial of service;
- access, modify, or exfiltrate data belonging to another organization;
- use social engineering against users or staff.

Testing against your own local checkout is fine.

## Supported versions

Only the current `main` branch is supported. There are no maintained release
branches, and older commits receive no fixes.

## Known posture

Stated plainly, because a security policy that hides its own gaps is not one:

- **The repository is public.** Proprietary source has already been disclosed
  and that disclosure is irreversible. Making the repository private later
  would not retract it.
- **Dependency vulnerabilities are open.** GitHub reports critical- and
  high-severity advisories against the default branch. Production runtime
  dependencies are gated separately by a blocking CI check, but the total is
  not zero.
- **There is no independent reviewer.** Changes can currently reach `main`
  without a second person approving them.

The threat model is maintained at
[`docs/security/THREAT_MODEL.md`](./docs/security/THREAT_MODEL.md).

## Scope

In scope: application code in this repository, its CI/CD configuration, and the
production deployment at `процент-агро.рф`.

Out of scope: third-party infrastructure and integration providers (1С, ЭДО,
Диадок, СБИС, banks, ФГИС, РЖД/ЭТРАН, КриптоПро, ФНС, Росреестр), and the Qwen
foundation model, which is third-party infrastructure used unmodified behind a
first-party adapter.
