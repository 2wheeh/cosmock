# cosmock

HTTP testing instances for Cosmos. Lightweight Cosmos SDK node management via child processes.

## Architecture

```
src/
├── index.ts              # Public API: export { Instance }
├── Instance.ts           # define() lifecycle + re-exports instances (Instance.simd)
├── cosmos.ts             # cosmosBase() — shared Cosmos SDK chain setup
├── process.ts            # tinyexec-based process wrapper
├── utils.ts              # stripColors, toArgs
└── instances/
    └── simd.ts           # Thin wrapper: cosmosBase({ binary: 'simd' })
```

### Key patterns

- **Instance.define()** — factory pattern from prool. Manages lifecycle (start/stop/restart), status transitions, event emitting, message buffering.
- **cosmosBase()** — shared setup for any Cosmos SDK binary: init → genesis patch → keys → gentx → config patch → start → health poll.
- **Instance wrappers** (simd.ts) are thin: just set binary name + defaults, delegate to cosmosBase.
- **Events** via mitt (on/off only, no once/addListener).
- **Process management** via tinyexec with resolver pattern for startup detection.

### Adding a new chain instance

```ts
// src/instances/gaiad.ts
export const gaiad = Instance.define((parameters?: GaiadParameters) => {
  const { binary = 'gaiad', ...rest } = parameters || {}
  return cosmosBase({ binary, name: 'gaiad', ...rest })
})
```

Then re-export from Instance.ts.

## Commands

- `pnpm test` — run vitest (unit + integration)
- `pnpm build` — tsc build
- Integration tests require `simd` in PATH (skipped otherwise)

## Dependencies

- **tinyexec** — process spawning (not execa, not raw child_process)
- **mitt** — events (not eventemitter3)
- **get-port** — port allocation (not yet used, available)
- **@cosmjs/stargate + @cosmjs/proto-signing** — dev deps for integration tests

## Design decisions

- No Pool/Server layer (unlike prool) — Cosmos nodes expose their own RPC/gRPC/API, proxy unnecessary
- No Docker — child process only
- cosmosBase handles SDK version differences (v0.47 vs v0.50+ genesis structure)
- patchGenesis hook for chain-specific genesis modifications
- Mnemonic recovery uses execSync with shell pipe (tinyexec doesn't support stdin)
