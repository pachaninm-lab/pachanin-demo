# Open-source and third-party software policy

Open-source software may be used only as approved infrastructure, build tooling
or an explicitly classified external integration. It must never be described as
internally authored product code.

Each concrete version requires recorded source, license, commercial-use basis,
obligations, runtime/build/dev scope, security status and decision. Unknown or
custom licenses require review. AGPL, GPL, SSPL, BUSL and other restrictive or
source-available product/runtime obligations are blocked without a separate
owner and legal decision.

New dependencies require necessity, maintainer/security assessment, CVE review,
install-script/transitive review and analysis of a small first-party alternative.
Cryptography, password hashing, MFA/WebAuthn/TOTP and other security primitives
must use approved implementations rather than home-grown replacements.

No proprietary source or source phrase may be uploaded to a public scanner or
SaaS without separate written owner approval.
