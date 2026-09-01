---
'starskiff': patch
---

Upgrade the XPLA default to v1.12.0, which contains the complete GHSA-7g4w-cg88-2cq2 underflow fix. Package XPLA's checksummed official release binaries in a Starskiff-published multi-arch image because the patched upstream GHCR build is unavailable, and pin the published artifact by immutable manifest digest.
