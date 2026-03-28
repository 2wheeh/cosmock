# cosmock

HTTP testing instances for Cosmos.

Lightweight alternative to [Starship](https://github.com/cosmology-tech/starship) — run real Cosmos SDK chain nodes as child processes without Docker or Kubernetes.

Inspired by [prool](https://github.com/wevm/prool) (HTTP testing instances for Ethereum).

## Features

- Spawn real Cosmos SDK nodes (simd) as child processes
- No Docker, no Kubernetes — just a Go binary
- Genesis account injection with mnemonic recovery
- Full lifecycle management (start/stop/restart)
- Compatible with [@cosmjs/stargate](https://github.com/cosmos/cosmjs) for testing
- Extensible to any Cosmos SDK chain binary (gaiad, osmosisd, etc.)

## Install

```bash
pnpm add -D cosmock
```

### Prerequisites

simd binary (ibc-go simapp):

```bash
go install cosmossdk.io/simapp/simd@latest
```

Or build from source if `go install` fails due to replace directives:

```bash
git clone --depth 1 https://github.com/cosmos/cosmos-sdk.git /tmp/cosmos-sdk
cd /tmp/cosmos-sdk/simapp && go build -o ~/go/bin/simd ./simd/
```

## Usage

```ts
import { Instance } from 'cosmock'

const instance = Instance.simd({
  chainId: 'test-1',
  denom: 'stake',
  accounts: [
    {
      mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      coins: '1000000000stake',
      name: 'alice',
    },
  ],
})

await instance.start()

// Connect with cosmjs
import { StargateClient } from '@cosmjs/stargate'
const client = await StargateClient.connect(`http://localhost:${instance.port}`)
const balance = await client.getBalance(address, 'stake')

await instance.stop()
```

### vitest globalSetup

```ts
// test/setup.ts
import { Instance } from 'cosmock'

export default async function () {
  const instance = Instance.simd({
    chainId: 'test-1',
    accounts: [
      { mnemonic: '...', coins: '1000000000stake' },
    ],
  })
  await instance.start()
  process.env.COSMOS_RPC_URL = `http://localhost:${instance.port}`

  return () => instance.stop()
}
```

### Multi-chain

```ts
const chain1 = Instance.simd({
  chainId: 'cosmos-1',
  rpcPort: 26657,
  grpcPort: 9090,
  apiPort: 1317,
  p2pPort: 26656,
})

const chain2 = Instance.simd({
  chainId: 'cosmos-2',
  rpcPort: 26660,
  grpcPort: 9092,
  apiPort: 1318,
  p2pPort: 26661,
})

await Promise.all([chain1.start(), chain2.start()])
```

### Custom chain binary

```ts
import { Instance, cosmosBase } from 'cosmock'

// Any Cosmos SDK binary works — same init/genesis/start flow
const gaiad = Instance.define((params) =>
  cosmosBase({ binary: 'gaiad', name: 'gaiad', ...params })
)
```

## API

### `Instance.simd(parameters?)`

Creates a simd instance.

**Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `binary` | `string` | `"simd"` | Path to binary |
| `chainId` | `string` | `"cosmock-1"` | Chain ID |
| `denom` | `string` | `"stake"` | Default denom |
| `accounts` | `CosmosAccount[]` | `[]` | Genesis accounts |
| `minimumGasPrices` | `string` | `"0{denom}"` | Minimum gas prices |
| `rpcPort` | `number` | `26657` | CometBFT RPC port |
| `grpcPort` | `number` | `9090` | gRPC port |
| `apiPort` | `number` | `1317` | REST API port |
| `p2pPort` | `number` | `26656` | P2P port |
| `grpcWebPort` | `number` | `9091` | gRPC-Web port |
| `pprofPort` | `number` | `6060` | pprof port |

### Instance options (second argument)

| Option | Type | Default | Description |
|---|---|---|---|
| `messageBuffer` | `number` | `20` | Max messages to store in-memory |
| `timeout` | `number` | `60000` | Start/stop timeout in milliseconds |

```ts
const instance = Instance.simd({ chainId: 'test-1' }, { timeout: 30_000 })
```

### Instance methods

| Method | Description |
|---|---|
| `start()` | Start the instance. Returns a stop function. |
| `stop()` | Stop the instance and cleanup temp directory. |
| `restart()` | Stop then start. |
| `on(event, handler)` | Listen to events (`message`, `stdout`, `stderr`, `listening`, `exit`). |
| `off(event, handler)` | Remove event listener. |

### Instance properties

| Property | Type | Description |
|---|---|---|
| `status` | `string` | `idle` / `starting` / `started` / `stopping` / `stopped` / `restarting` |
| `host` | `string` | Host (default: `localhost`) |
| `port` | `number` | RPC port |
| `name` | `string` | Instance name |
| `messages` | `object` | `.get()` returns buffered messages, `.clear()` clears them |

## Testing strategies

| Strategy | Isolation | Speed | Use case |
|---|---|---|---|
| **Account isolation** | Practical | Fast | Most tests — each test uses unique accounts |
| **Suite-level instance** | Full | ~5s setup | Tests that modify chain-wide state |
| **Shared instance** | None | Fastest | Read-only queries, smoke tests |

Recommended: fund multiple accounts in genesis, assign each test its own account(s).

## Why not Starship?

|  | Starship | cosmock |
|---|---|---|
| Infra | Kubernetes + Helm + Docker | None (child process) |
| Startup | 2-5 min | 3-5 sec |
| Dependencies | K8s cluster | Go binary |
| State reset | Helm redeploy (minutes) | kill + restart (~3s) |
| Best for | Production simulation | Dev/test |

## License

MIT
