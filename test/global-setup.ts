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

  provide('testMnemonic', TEST_MNEMONIC)

  return async () => {
    await Promise.all(cleanups.map((fn) => fn()))
  }
}

declare module 'vitest' {
  export interface ProvidedContext {
    simdRpcUrl: string | undefined
    wasmdRpcUrl: string | undefined
    testMnemonic: string
  }
}
