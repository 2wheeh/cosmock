import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import * as Instance from '../Instance.js'
import type { CosmosInstance } from '../cosmos.js'
import { createProcess } from '../process.js'

export type HermesParameters = {
  /** Path to the hermes binary. @default "hermes" */
  binary?: string
  /** Chain A instance (must be started). */
  chainA: CosmosInstance
  /** Chain B instance (must be started). */
  chainB: CosmosInstance
  /** Mnemonic for the relayer account (must be funded on both chains). */
  mnemonic: string
  /** Gas price amount. @default "0.025" */
  gasPrice?: string
  /** Telemetry port. @default 3001 */
  telemetryPort?: number
}

/**
 * Defines a Hermes IBC relayer instance.
 *
 * Connects two Cosmos SDK chains and relays IBC packets between them.
 * Both chains must be running before starting the relayer.
 * The relayer mnemonic must be funded on both chains via genesis accounts.
 *
 * @example
 * ```ts
 * const chainA = Instance.wasmd({ chainId: 'ibc-a', prefix: 'wasm', accounts: [
 *   { mnemonic: RELAYER_MNEMONIC, coins: '1000000000stake', name: 'relayer' },
 * ]})
 * const chainB = Instance.wasmd({ chainId: 'ibc-b', prefix: 'wasm', ... })
 * await Promise.all([chainA.start(), chainB.start()])
 *
 * const relayer = Instance.hermes({
 *   chainA,
 *   chainB,
 *   mnemonic: RELAYER_MNEMONIC,
 * })
 * await relayer.start()
 * ```
 */
export const hermes = Instance.define((parameters: HermesParameters) => {
  const {
    binary = 'hermes',
    chainA,
    chainB,
    mnemonic,
    gasPrice = '0.025',
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

      // 1. Write config (derive URLs from chain instances)
      fs.writeFileSync(configPath, generateConfig({ chainA, chainB, gasPrice, telemetryPort }))

      const run = (args: string[]) => {
        const result = spawnSync(binary, ['--config', configPath, ...args], {
          stdio: 'pipe',
          timeout: 300_000,
        })
        const stderr = result.stderr?.toString() || ''
        const stdout = result.stdout?.toString() || ''
        if (result.status !== 0) {
          throw new Error(`hermes ${args.join(' ')} failed (exit ${result.status}, signal ${result.signal}):\n${stderr}\n${stdout}`)
        }
        return stdout + stderr
      }

      // 2. Add relayer key to both chains
      const mnemonicFile = path.join(homeDir, 'mnemonic.txt')
      fs.writeFileSync(mnemonicFile, mnemonic)

      for (const chain of [chainA, chainB]) {
        run(['keys', 'add', '--chain', chain.chainId, '--mnemonic-file', mnemonicFile, '--overwrite'])
      }

      // 3. Verify chains are reachable
      run(['health-check'])

      // 4. Create clients, connection, and channel (step by step)
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
  chainA: CosmosInstance
  chainB: CosmosInstance
  gasPrice: string
  telemetryPort: number
}): string {
  const { chainA, chainB, gasPrice, telemetryPort } = opts

  function chainSection(chain: CosmosInstance): string {
    const rpcUrl = `http://${chain.host}:${chain.port}`
    const grpcUrl = `http://${chain.host}:${chain.grpcPort}`

    return `
[[chains]]
id = '${chain.chainId}'
type = 'CosmosSdk'
rpc_addr = '${rpcUrl}'
grpc_addr = '${grpcUrl}'
event_source = { mode = 'push', url = '${rpcUrl.replace('http', 'ws')}/websocket', batch_delay = '500ms' }
account_prefix = '${chain.prefix}'
key_name = 'relayer'
store_prefix = 'ibc'
default_gas = 1000000
max_gas = 10000000
gas_price = { price = ${gasPrice}, denom = '${chain.denom}' }
gas_multiplier = 1.2
max_msg_num = 30
max_tx_size = 180000
clock_drift = '5s'
max_block_time = '10s'
trusting_period = '14days'
memo_prefix = ''
sequential_batch_tx = false
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
