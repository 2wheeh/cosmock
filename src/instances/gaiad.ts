import * as Instance from '../Instance.js'
import { cosmosBase, type CosmosChainParameters } from '../cosmos.js'

export type GaiadParameters = CosmosChainParameters & {
  /** Path to the gaiad binary. @default "gaiad" */
  binary?: string
}

/**
 * Defines a gaiad (Cosmos Hub) instance.
 *
 * Includes IBC module but no CosmWasm. Useful as an IBC counterparty chain.
 *
 * @example
 * ```ts
 * const instance = Instance.gaiad({
 *   chainId: 'cosmoshub-test-1',
 *   denom: 'uatom',
 *   accounts: [{ mnemonic: '...', coins: '1000000000uatom' }],
 * })
 * await instance.start()
 * await instance.stop()
 * ```
 */
export const gaiad = Instance.define((parameters?: GaiadParameters) => {
  const { binary = 'gaiad', ...rest } = parameters || {}
  return cosmosBase({ binary, name: 'gaiad', ...rest })
})
