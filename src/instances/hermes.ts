import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import * as Instance from '../Instance.js'
import { createProcess } from '../process.js'

export type HermesChain = {
  /** Chain ID. */
  chainId: string
  /** CometBFT RPC URL (e.g. "http://localhost:26657"). */
  rpcUrl: string
  /** gRPC URL (e.g. "http://localhost:9090"). */
  grpcUrl: string
  /** Account prefix (e.g. "cosmos", "wasm"). */
  prefix: string
  /** Mnemonic for the relayer account on this chain. */
  mnemonic: string
  /** Default denom. @default "stake" */
  denom?: string
  /** Gas price amount. @default "0.025" */
  gasPrice?: string
}

export type HermesParameters = {
  /** Path to the hermes binary. @default "hermes" */
  binary?: string
  /** Chain A configuration. */
  chainA: HermesChain
  /** Chain B configuration. */
  chainB: HermesChain
  /** Telemetry port. @default 3001 */
  telemetryPort?: number
}

/**
 * Defines a Hermes IBC relayer instance.
 *
 * Connects two Cosmos SDK chains and relays IBC packets between them.
 * Both chains must be running before starting the relayer.
 *
 * @example
 * ```ts
 * const relayer = Instance.hermes({
 *   chainA: { chainId: 'wasm-1', rpcUrl: 'http://localhost:26657', grpcUrl: 'http://localhost:9090', prefix: 'wasm', mnemonic: '...' },
 *   chainB: { chainId: 'wasm-2', rpcUrl: 'http://localhost:26660', grpcUrl: 'http://localhost:9092', prefix: 'wasm', mnemonic: '...' },
 * })
 * await relayer.start()
 * // IBC channel is created and packets are being relayed
 * await relayer.stop()
 * ```
 */
export const hermes = Instance.define((parameters: HermesParameters) => {
  const {
    binary = 'hermes',
    chainA,
    chainB,
    telemetryPort = 3001,
  } = parameters

  const name = 'hermes'
  const process = createProcess(name)
  let homeDir: string | undefined

  return {
    name,
    host: 'localhost',
    port: telemetryPort,

    async start(_opts, { emitter }) {
      homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cosmock-hermes-'))
      const configPath = path.join(homeDir, 'config.toml')

      // 1. Write config
      fs.writeFileSync(configPath, generateConfig({
        chainA,
        chainB,
        telemetryPort,
      }))

      const run = (args: string[]) => {
        const result = spawnSync(binary, ['--config', configPath, ...args], {
          stdio: 'pipe',
          timeout: 120_000,
        })
        const stderr = result.stderr?.toString() || ''
        const stdout = result.stdout?.toString() || ''
        if (result.status !== 0) {
          throw new Error(`hermes ${args.join(' ')} failed: ${stderr || stdout}`)
        }
        return stdout + stderr
      }

      // 2. Add keys for each chain
      for (const chain of [chainA, chainB]) {
        const mnemonicFile = path.join(homeDir, `${chain.chainId}-mnemonic.txt`)
        fs.writeFileSync(mnemonicFile, chain.mnemonic)
        run([
          'keys', 'add',
          '--chain', chain.chainId,
          '--mnemonic-file', mnemonicFile,
          '--overwrite',
        ])
      }

      // 3. Create clients, connection, and channel (step by step)
      run(['create', 'client', '--host-chain', chainA.chainId, '--reference-chain', chainB.chainId])
      run(['create', 'client', '--host-chain', chainB.chainId, '--reference-chain', chainA.chainId])
      run(['create', 'connection', '--a-chain', chainA.chainId, '--a-client', '07-tendermint-0', '--b-client', '07-tendermint-0'])
      run(['create', 'channel', '--a-chain', chainA.chainId, '--a-connection', 'connection-0', '--a-port', 'transfer', '--b-port', 'transfer'])

      // 4. Start relaying
      return process.start(
        binary,
        ['--config', configPath, 'start'],
        {
          emitter,
          resolver({ process: proc, resolve, reject }) {
            let resolved = false

            const check = (data: Buffer) => {
              if (resolved) return
              const msg = data.toString()
              // Hermes logs "Hermes has started" or "spawning supervisor" when ready
              if (
                msg.includes('Hermes has started') ||
                msg.includes('spawning supervisor')
              ) {
                resolved = true
                setTimeout(resolve, 2000)
              }
            }

            proc.process?.stdout?.on('data', check)
            proc.process?.stderr?.on('data', check)

            proc.process?.on('exit', (code: number | null) => {
              if (!resolved) {
                reject(`hermes exited with code ${code}`)
              }
            })
          },
        },
      )
    },

    async stop() {
      await process.stop()
      if (homeDir) {
        fs.rmSync(homeDir, { recursive: true, force: true })
        homeDir = undefined
      }
    },
  }
})

function generateConfig(opts: {
  chainA: HermesChain
  chainB: HermesChain
  telemetryPort: number
}): string {
  const { chainA, chainB, telemetryPort } = opts

  function chainSection(chain: HermesChain): string {
    const gasPrice = chain.gasPrice ?? '0.025'
    const denom = chain.denom ?? 'stake'

    return `
[[chains]]
id = '${chain.chainId}'
type = 'CosmosSdk'
rpc_addr = '${chain.rpcUrl}'
grpc_addr = '${chain.grpcUrl}'
event_source = { mode = 'push', url = '${chain.rpcUrl.replace('http', 'ws')}/websocket', batch_delay = '500ms' }
account_prefix = '${chain.prefix}'
key_name = 'relayer'
store_prefix = 'ibc'
default_gas = 1000000
max_gas = 10000000
gas_price = { price = ${gasPrice}, denom = '${denom}' }
gas_multiplier = 1.2
max_msg_num = 30
max_tx_size = 180000
clock_drift = '5s'
max_block_time = '30s'
trusting_period = '14days'
trust_threshold = { numerator = '1', denominator = '3' }
address_type = { derivation = 'cosmos' }
`
  }

  return `[global]
log_level = 'info'

[mode]

[mode.clients]
enabled = true
refresh = true
misbehaviour = false

[mode.connections]
enabled = false

[mode.channels]
enabled = false

[mode.packets]
enabled = true
clear_interval = 100
clear_on_start = true
tx_confirmation = false

[rest]
enabled = false
host = '127.0.0.1'
port = 3000

[telemetry]
enabled = false
host = '127.0.0.1'
port = ${telemetryPort}
${chainSection(chainA)}
${chainSection(chainB)}
`
}
