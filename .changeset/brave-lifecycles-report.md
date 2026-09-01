---
'starskiff': minor
---

Make `Instance.start()` resolve with `void` instead of a redundant stop
function, and add `Symbol.asyncDispose` for automatic cleanup with
`await using`.

Startup failures now retain the active phase, logical chain command, command
failure details, and a bounded 50-line output tail even after automatic
cleanup clears the public message buffer.
