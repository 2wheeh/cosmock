import {
  Instance,
  type CosmosBaseParameters,
  type CosmosEvmBaseParameters,
  type CosmosEvmChainParameters,
  type CosmosRuntimeOptions,
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
expectTypeOf<CosmosBaseParameters['runtime']>().toEqualTypeOf<CosmosRuntimeOptions | undefined>()
expectTypeOf<CosmosEvmBaseParameters['runtime']>().toEqualTypeOf<CosmosRuntimeOptions | undefined>()
expectTypeOf<'runtime' extends keyof MaroodParameters ? true : false>().toEqualTypeOf<false>()

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

const optionShapedFactory = Instance.define((parameters?: { timeout?: number }) => ({
  name: 'option-shaped-parameters',
  host: 'localhost',
  port: parameters?.timeout ?? 3000,
  async start() {},
  async stop() {},
}))
expectTypeOf(optionShapedFactory({ timeout: 4000 }).port).toBeNumber()
expectTypeOf(optionShapedFactory(undefined, { timeout: 1000 }).port).toBeNumber()

const parameterlessFactory = Instance.define(() => ({
  name: 'parameterless',
  host: 'localhost',
  port: 3000,
  async start() {},
  async stop() {},
}))
expectTypeOf(parameterlessFactory(undefined, { messageBuffer: 1 }).port).toBeNumber()
// @ts-expect-error Parameterless definitions receive lifecycle options in the second argument.
parameterlessFactory({ timeout: 1000 })

const requiredFactory = Instance.define((parameters: { port: number }) => ({
  name: 'required-parameters',
  host: 'localhost',
  port: parameters.port,
  async start() {},
  async stop() {},
}))
// @ts-expect-error Required definition parameters cannot be omitted.
requiredFactory()
