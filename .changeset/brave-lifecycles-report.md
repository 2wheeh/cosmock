---
'starskiff': minor
---

Make `Instance.start()` resolve with `void` instead of a redundant stop
function, and add `Symbol.asyncDispose` for automatic cleanup with
`await using`.

The public lifecycle interface changes as follows:

```diff
- start(): Promise<() => void>
+ start(): Promise<void>
+ [Symbol.asyncDispose](): Promise<void>
```

Callers that used the returned stop function should migrate to the instance
method:

```diff
- const stop = await instance.start()
- await stop()
+ await instance.start()
+ await instance.stop()
```

Startup failures now retain the active phase, logical chain command, command
failure details, and a bounded 50-line output tail even after automatic
cleanup clears the public message buffer.
