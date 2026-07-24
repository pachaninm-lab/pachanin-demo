# PC-CROP predecessor trigger governance

Issue: #3170

This governance slice changes only historical workflow trigger ownership. The `permissions:` and `jobs:` bodies of PC-CROP-07A, PC-CROP-07B, PC-CROP-08B, PC-CROP-08C and PC-CROP-08D are hash-locked and must remain byte-identical.

Historical workflows trigger only when their own immutable authority files change. Shared modules, central guard files and successor adapter files are validated by current successor or repository-wide gates.

Operational status remains `NOT_ATTESTED`. Production hosting remains `REG_RU_VPS_ONLY`.
