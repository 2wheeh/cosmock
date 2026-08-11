---
'starskiff': minor
---

Make `Instance.define` factories treat the first argument strictly as definition parameters and the second as lifecycle options, removing key-based argument guessing. Parameterless definitions now pass `undefined` before lifecycle options.
