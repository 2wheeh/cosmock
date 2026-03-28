import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { execSync } from 'node:child_process'
import { Instance } from '../src/index.js'

// Skip all tests if simd binary is not available
const hasBinary = (() => {
  try {
    execSync('simd version', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
})()

const TEST_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

describe.skipIf(!hasBinary)('simd instance', () => {
  let instance: Instance.Instance

  beforeAll(async () => {
    instance = Instance.simd({
      chainId: 'cosmock-test-1',
      denom: 'stake',
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
    const data = (await res.json()) as any
    expect(Number(data.result.sync_info.latest_block_height)).toBeGreaterThan(0)
  })

  it('connects with StargateClient and queries balance', async () => {
    const { StargateClient } = await import('@cosmjs/stargate')
    const { DirectSecp256k1HdWallet } = await import('@cosmjs/proto-signing')

    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(TEST_MNEMONIC, {
      prefix: 'cosmos',
    })
    const [account] = await wallet.getAccounts()

    const client = await StargateClient.connect(`http://localhost:${instance.port}`)
    const balance = await client.getBalance(account.address, 'stake')

    expect(BigInt(balance.amount)).toBeGreaterThan(0n)
    client.disconnect()
  })

  it('can send tokens', async () => {
    const { SigningStargateClient } = await import('@cosmjs/stargate')
    const { DirectSecp256k1HdWallet } = await import('@cosmjs/proto-signing')

    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(TEST_MNEMONIC, {
      prefix: 'cosmos',
    })
    const [sender] = await wallet.getAccounts()

    const recipient = 'cosmos1qypqxpq9qcrsszg2pvxq6rs0zqg3yyc5lzv7xu'

    const client = await SigningStargateClient.connectWithSigner(
      `http://localhost:${instance.port}`,
      wallet,
    )

    const result = await client.sendTokens(
      sender.address,
      recipient,
      [{ denom: 'stake', amount: '1000' }],
      { amount: [{ denom: 'stake', amount: '500' }], gas: '200000' },
    )

    expect(result.code).toBe(0)

    // Verify recipient balance
    const balance = await client.getBalance(recipient, 'stake')
    expect(balance.amount).toBe('1000')

    client.disconnect()
  })
})
