import * as Instance from '../Instance.js'
import { cosmosEvmBase, type CosmosEvmChainParameters } from '../cosmos.js'

export type XpladParameters = CosmosEvmChainParameters & {
  /** Path to the xplad binary. @default "xplad" */
  binary?: string
}

/**
 * Defines an xplad (XPLA) instance.
 *
 * XPLA is a Cosmos SDK chain with EVM and CosmWasm support.
 * The native denom uses 18 decimals (e.g. axpla), which requires
 * larger validator stake/balance than the cosmosBase defaults.
 *
 * @example
 * ```ts
 * const instance = Instance.xplad({
 *   accounts: [{ mnemonic: '...', coins: '1000000000000000000000axpla' }],
 * })
 * await instance.start()
 * await instance.stop()
 * ```
 */
export const xplad = Instance.define((parameters?: XpladParameters) => {
  const {
    binary = 'xplad',
    chainId = 'dimension_37-1',
    denom = 'axpla',
    prefix = 'xpla',
    // 18-decimal denom needs large amounts: xpla DefaultPowerReduction ~ 1.37e12
    validatorBalance = '100000000000000000000000', // 1e23
    validatorStake = '10000000000000000000000',    // 1e22
    ...rest
  } = parameters || {}

  return cosmosEvmBase({
    binary, name: 'xpla', chainId, denom, prefix, validatorBalance, validatorStake, ...rest,
    patchGenesis: (genesis) => {
      // xplad requires evm_denom and bank.denom_metadata to match the native denom
      const evm = (genesis.app_state as Record<string, unknown>).evm as
        | { params: { evm_denom: string; extended_denom_options?: { extended_denom: string } } }
        | undefined
      if (evm?.params) {
        evm.params.evm_denom = denom
        if (evm.params.extended_denom_options) {
          evm.params.extended_denom_options.extended_denom = denom
        }
      }

      // bank denom_metadata is required by EVM coin info init
      const display = denom.replace(/^a/, '')
      if (genesis.app_state.bank) {
        genesis.app_state.bank.denom_metadata = [{
          description: 'The native token.',
          denom_units: [
            { denom, exponent: 0, aliases: [] },
            { denom: display, exponent: 18, aliases: [] },
          ],
          base: denom,
          display,
          name: display.toUpperCase(),
          symbol: display.toUpperCase(),
          uri: '',
          uri_hash: '',
        }]
      }

      return genesis
    },
  })
})
