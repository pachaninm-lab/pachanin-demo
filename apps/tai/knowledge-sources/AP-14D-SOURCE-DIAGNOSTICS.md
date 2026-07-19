# AP-14D source diagnostics

The controlled live-source collector must not collapse all network failures into one generic transport result.

## Bounded categories

The diagnostic fetcher records only stable categories:

- DNS resolution and DNS-inside-transport failures;
- TLS certificate verification and TLS handshake failures;
- timeout, refused, reset, aborted, broken, unreachable and unknown transport failures;
- remote disconnect, malformed HTTP status, incomplete response and generic HTTP protocol failures;
- existing HTTP status, redirect, MIME, charset, size, decompression and content-quarantine codes.

No exception message, IP address, certificate body, hostname expansion, response body or secret is copied into evidence. Unknown programming exceptions are re-raised instead of being mislabeled as network failures.

Transient DNS and transport failures remain retryable. Certificate verification and policy violations remain permanent and fail closed.

This slice improves source remediation evidence only. It does not by itself raise topic coverage or change TAI operational status from `NOT_ATTESTED`.
