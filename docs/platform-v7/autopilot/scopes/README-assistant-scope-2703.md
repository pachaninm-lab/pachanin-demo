# Independent scope approval for PR #2703

This authority change is intentionally separate from the implementation branch.

It approves only the listed assistant implementation, transport, mobile viewport and acceptance-test paths. It does not grant account access, cross-role authority, autonomous commands, external public model calls or persistence of full public questions.

The implementation PR must still pass all exact-head CI, security, runtime and production-like Kubernetes gates.
