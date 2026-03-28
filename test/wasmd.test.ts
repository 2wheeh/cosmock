import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { Instance } from '../src/index.js'
import { GasPrice } from '@cosmjs/stargate'

const hasBinary = (() => {
  try {
    execSync('wasmd version', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
})()

const TEST_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

describe.skipIf(!hasBinary)('wasmd instance', () => {
  let instance: Instance.Instance

  beforeAll(async () => {
    instance = Instance.wasmd({
      chainId: 'wasm-test-1',
      denom: 'stake',
      rpcPort: 26757,
      grpcPort: 9190,
      apiPort: 1417,
      p2pPort: 26756,
      grpcWebPort: 9191,
      pprofPort: 6160,
      accounts: [
        {
          mnemonic: TEST_MNEMONIC,
          coins: '1000000000stake',
          name: 'alice',
        },
      ],
    })

    await instance.start()
  }, 60_000)

  afterAll(async () => {
    if (instance) await instance.stop()
  })

  it('has started status', () => {
    expect(instance.status).toBe('started')
  })

  it('responds to RPC /status', async () => {
    const res = await fetch(`http://localhost:${instance.port}/status`)
    expect(res.ok).toBe(true)
  })

  it('uploads, instantiates, and executes a wasm contract', async () => {
    const { SigningCosmWasmClient } = await import('@cosmjs/cosmwasm-stargate')
    const { DirectSecp256k1HdWallet } = await import('@cosmjs/proto-signing')

    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(TEST_MNEMONIC, {
      prefix: 'wasm',
    })
    const [account] = await wallet.getAccounts()

    const client = await SigningCosmWasmClient.connectWithSigner(
      `http://localhost:${instance.port}`,
      wallet,
      { gasPrice: GasPrice.fromString('0stake') },
    )

    // Upload
    const wasmPath = path.join(import.meta.dirname, 'testdata', 'hackatom.wasm')
    const wasmCode = fs.readFileSync(wasmPath)

    const { codeId } = await client.upload(account.address, wasmCode, 'auto')
    expect(codeId).toBeGreaterThan(0)

    // Instantiate
    const { contractAddress } = await client.instantiate(
      account.address,
      codeId,
      { verifier: account.address, beneficiary: account.address },
      'hackatom-test',
      'auto',
    )
    expect(contractAddress).toBeTruthy()

    // Execute: hackatom "release" sends funds to beneficiary
    const result = await client.execute(
      account.address,
      contractAddress,
      { release: {} },
      'auto',
    )
    // ExecuteResult has transactionHash but no code (code=0 is omitted)
    expect(result.transactionHash).toBeTruthy()

    client.disconnect()
  }, 60_000)
})
