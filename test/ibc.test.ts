import { describe, it, expect, inject } from 'vitest';

const chainARpcUrl = inject('ibcChainARpcUrl');
const chainBRpcUrl = inject('ibcChainBRpcUrl');
const mnemonic = inject('testMnemonic');

describe.skipIf(!chainARpcUrl || !chainBRpcUrl)('IBC transfer', () => {
  it('sends tokens from chain A to chain B via IBC', async () => {
    const { SigningStargateClient, StargateClient, GasPrice } = await import('@cosmjs/stargate');
    const { DirectSecp256k1HdWallet } = await import('@cosmjs/proto-signing');

    // Create wallets for both chains
    const walletA = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix: 'wasm' });
    const walletB = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix: 'wasm' });
    const [accountA] = await walletA.getAccounts();
    const [accountB] = await walletB.getAccounts();

    // Connect to both chains
    const clientA = await SigningStargateClient.connectWithSigner(chainARpcUrl!, walletA, {
      gasPrice: GasPrice.fromString('0stake'),
    });
    const clientB = await StargateClient.connect(chainBRpcUrl!);

    // Check initial balance on chain A
    const balanceBefore = await clientA.getBalance(accountA.address, 'stake');
    expect(BigInt(balanceBefore.amount)).toBeGreaterThan(0n);

    // Get current block height on chain B for timeout
    const chainBHeight = await clientB.getHeight();

    // Send IBC transfer from chain A to chain B
    const amount = { denom: 'stake', amount: '1000000' };
    const result = await clientA.sendIbcTokens(
      accountA.address,
      accountB.address,
      amount,
      'transfer',
      'channel-0',
      undefined,
      (Math.floor(Date.now() / 1000) + 600) * 1_000_000_000, // 10 min timeout (nanoseconds)
      { amount: [{ denom: 'stake', amount: '5000' }], gas: '300000' },
    );
    if (result.code !== 0) {
      console.error('IBC transfer failed:', result.rawLog || JSON.stringify(result));
    }
    expect(result.code).toBe(0);

    // Wait for relayer to relay the packet
    await new Promise(r => setTimeout(r, 10_000));

    // Check balance on chain B (should have IBC denom)
    const balancesB = await clientB.getAllBalances(accountB.address);
    const ibcBalance = balancesB.find(b => b.denom.startsWith('ibc/'));

    expect(ibcBalance).toBeTruthy();
    expect(BigInt(ibcBalance!.amount)).toBe(BigInt(amount.amount));

    clientA.disconnect();
    clientB.disconnect();
  }, 60_000);
});
