import * as Instance from '../Instance.js'
import { cosmosBase, type CosmosAccount } from '../cosmos.js'

export type SimdParameters = {
  /** Path to the simd binary. @default "simd" */
  binary?: string
  /** Chain ID. @default "cosmock-1" */
  chainId?: string
  /** Default denom. @default "stake" */
  denom?: string
  /** Accounts to fund in genesis. */
  accounts?: CosmosAccount[]
  /** Minimum gas prices. @default "0{denom}" */
  minimumGasPrices?: string
  /** RPC listen address port. @default 26657 */
  rpcPort?: number
  /** gRPC listen port. @default 9090 */
  grpcPort?: number
  /** API (REST) listen port. @default 1317 */
  apiPort?: number
  /** P2P listen port. @default 26656 */
  p2pPort?: number
  /** gRPC-Web listen port. @default 9091 */
  grpcWebPort?: number
  /** pprof listen port. @default 6060 */
  pprofPort?: number
}

/**
 * Defines a simd (Cosmos SDK simapp) instance.
 *
 * @example
 * ```ts
 * const instance = Instance.simd({
 *   chainId: 'test-1',
 *   accounts: [{ mnemonic: '...', coins: '1000000000stake' }],
 * })
 * await instance.start()
 * // instance.port → 26657 (CometBFT RPC)
 * await instance.stop()
 * ```
 */
export const simd = Instance.define((parameters?: SimdParameters) => {
  const { binary = 'simd', ...rest } = parameters || {}
  return cosmosBase({ binary, name: 'simd', ...rest })
})
