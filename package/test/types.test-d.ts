import {
  Instance,
  type CosmosBaseParameters,
  type CosmosEvmBaseParameters,
  type CosmosEvmChainParameters,
  type MaroodParameters,
  type MaroodPrivacyZkArtifacts,
} from '../src/index.js'
import { expectTypeOf } from 'vitest'

// CosmosInstance extra fields should be inferred
const chain = Instance.wasmd({ chainId: 'test', prefix: 'wasm' })
expectTypeOf(chain.chainId).toBeString()
expectTypeOf(chain.prefix).toBeString()
expectTypeOf(chain.denom).toBeString()
expectTypeOf(chain.grpcPort).toBeNumber()
expectTypeOf(chain.apiPort).toBeNumber()

// Base Instance fields still work
expectTypeOf(chain.host).toBeString()
expectTypeOf(chain.port).toBeNumber()
expectTypeOf(chain.name).toBeString()
expectTypeOf(chain.start).toBeFunction()
expectTypeOf(chain.stop).toBeFunction()

// simd too
const simdChain = Instance.simd({ chainId: 'test' })
expectTypeOf(simdChain.chainId).toBeString()

const xrplevmChain = Instance.xrplevm({ chainId: 'custom-xrplevm', evmChainId: 1440001 })
expectTypeOf(xrplevmChain.evmChainId).toBeNumber()
expectTypeOf(simdChain.grpcPort).toBeNumber()

expectTypeOf<CosmosEvmBaseParameters['evmChainId']>().toEqualTypeOf<number | undefined>()
expectTypeOf<'evmChainId' extends keyof CosmosEvmChainParameters ? true : false>().toEqualTypeOf<false>()
expectTypeOf<'evmChainId' extends keyof MaroodParameters ? true : false>().toEqualTypeOf<false>()
expectTypeOf<Extract<keyof CosmosBaseParameters, symbol>>().toEqualTypeOf<never>()
expectTypeOf<Extract<keyof CosmosEvmBaseParameters, symbol>>().toEqualTypeOf<never>()

const privacyZkArtifacts: MaroodPrivacyZkArtifacts = {
  kind: 'generated-test',
  directory: '/tmp/maroo-privacy-zk-test-artifacts',
}
const maroodChain = Instance.marood({ image: 'maroo:local', privacyZkArtifacts })
expectTypeOf(maroodChain.evmUrl).toBeString()

// Plain define without extras — no extra fields
const plain = Instance.define(() => ({
  name: 'plain',
  host: 'localhost',
  port: 3000,
  async start() {},
  async stop() {},
}))()

expectTypeOf(plain.host).toBeString()
expectTypeOf(plain.start).toBeFunction()
