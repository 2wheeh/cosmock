import { execSync } from 'node:child_process'
import type { TestProject } from 'vitest/node'
import { Instance } from '../src/index.js'

function hasBinary(name: string): boolean {
  try {
    execSync(`${name} version`, { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

const TEST_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

// Second mnemonic for relayer account
const RELAYER_MNEMONIC =
  'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong'

export default async function setup({ provide }: TestProject) {
  const cleanups: (() => Promise<void>)[] = []

  if (hasBinary('simd')) {
    const simd = Instance.simd({
      chainId: 'cosmock-test-1',
      denom: 'stake',
      accounts: [
        { mnemonic: TEST_MNEMONIC, coins: '1000000000stake', name: 'alice' },
      ],
    })
    await simd.start()
    cleanups.push(() => simd.stop())

    provide('simdRpcUrl', `http://localhost:${simd.port}`)
  }

  if (hasBinary('wasmd')) {
    const wasmd = Instance.wasmd({
      chainId: 'wasm-test-1',
      denom: 'stake',
      rpcPort: 26757,
      grpcPort: 9190,
      apiPort: 1417,
      p2pPort: 26756,
      grpcWebPort: 9191,
      pprofPort: 6160,
      accounts: [
        { mnemonic: TEST_MNEMONIC, coins: '1000000000stake', name: 'alice' },
      ],
    })
    await wasmd.start()
    cleanups.push(() => wasmd.stop())

    provide('wasmdRpcUrl', `http://localhost:${wasmd.port}`)
  }

  // IBC: two wasmd chains + hermes relayer
  if (hasBinary('wasmd') && hasBinary('hermes')) {
    const ibcChainA = Instance.wasmd({
      chainId: 'ibc-a',
      prefix: 'wasm',
      rpcPort: 26857,
      grpcPort: 9290,
      apiPort: 1517,
      p2pPort: 26856,
      grpcWebPort: 9291,
      pprofPort: 6260,
      accounts: [
        { mnemonic: TEST_MNEMONIC, coins: '1000000000stake', name: 'alice' },
        { mnemonic: RELAYER_MNEMONIC, coins: '1000000000stake', name: 'relayer' },
      ],
    })

    const ibcChainB = Instance.wasmd({
      chainId: 'ibc-b',
      prefix: 'wasm',
      rpcPort: 26957,
      grpcPort: 9390,
      apiPort: 1617,
      p2pPort: 26956,
      grpcWebPort: 9391,
      pprofPort: 6360,
      accounts: [
        { mnemonic: TEST_MNEMONIC, coins: '1000000000stake', name: 'alice' },
        { mnemonic: RELAYER_MNEMONIC, coins: '1000000000stake', name: 'relayer' },
      ],
    })

    await Promise.all([ibcChainA.start(), ibcChainB.start()])
    cleanups.push(() => ibcChainA.stop())
    cleanups.push(() => ibcChainB.stop())

    const relayer = Instance.hermes({
      chainA: ibcChainA,
      chainB: ibcChainB,
      mnemonic: RELAYER_MNEMONIC,
    }, { timeout: 180_000 })

    await relayer.start()
    cleanups.push(() => relayer.stop())

    provide('ibcChainARpcUrl', `http://${ibcChainA.host}:${ibcChainA.port}`)
    provide('ibcChainBRpcUrl', `http://${ibcChainB.host}:${ibcChainB.port}`)
  }

  provide('testMnemonic', TEST_MNEMONIC)

  return async () => {
    await Promise.all(cleanups.map((fn) => fn()))
  }
}

declare module 'vitest' {
  export interface ProvidedContext {
    simdRpcUrl: string | undefined
    wasmdRpcUrl: string | undefined
    ibcChainARpcUrl: string | undefined
    ibcChainBRpcUrl: string | undefined
    testMnemonic: string
  }
}
