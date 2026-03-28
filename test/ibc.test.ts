import { describe, it, expect, inject } from 'vitest';

const chainARpcUrl = inject('ibcChainARpcUrl');
const chainBRpcUrl = inject('ibcChainBRpcUrl');
const mnemonic = inject('testMnemonic');

describe('IBC transfer', () => {
  it('sends tokens from chain A to chain B via IBC', async () => {
    const { SigningStargateClient, StargateClient, GasPrice } = await import('@cosmjs/stargate');
    const { DirectSecp256k1HdWallet } = await import('@cosmjs/proto-signing');
    const { MsgTransfer } = await import('cosmjs-types/ibc/applications/transfer/v1/tx');

    // Create wallets for both chains
    const walletA = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix: 'wasm' });
    const walletB = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix: 'wasm' });
    const [accountA] = await walletA.getAccounts();
    const [accountB] = await walletB.getAccounts();

    // Connect to both chains
    const clientA = await SigningStargateClient.connectWithSigner(chainARpcUrl, walletA, {
      gasPrice: GasPrice.fromString('0stake'),
    });
    const clientB = await StargateClient.connect(chainBRpcUrl);

    // Check initial balance on chain A
    const balanceBefore = await clientA.getBalance(accountA.address, 'stake');
    expect(BigInt(balanceBefore.amount)).toBeGreaterThan(0n);

    // IBC transfer via MsgTransfer
    const transferMsg = {
      typeUrl: '/ibc.applications.transfer.v1.MsgTransfer',
      value: MsgTransfer.fromPartial({
        sourcePort: 'transfer',
        sourceChannel: 'channel-0',
        token: { denom: 'stake', amount: '1000000' },
        sender: accountA.address,
        receiver: accountB.address,
        timeoutTimestamp: BigInt((Math.floor(Date.now() / 1000) + 600) * 1_000_000_000),
      }),
    };

    const result = await clientA.signAndBroadcast(accountA.address, [transferMsg], 'auto');
    if (result.code !== 0) {
      console.error(
        'IBC transfer failed:',
        result.events.map(e => `${e.type}: ${e.attributes.map(a => `${a.key}=${a.value}`).join(', ')}`).join('; '),
      );
    }
    expect(result.code).toBe(0);

    // Wait for relayer to relay the packet
    await new Promise(r => setTimeout(r, 10_000));

    // Check balance on chain B (should have IBC denom)
    const balancesB = await clientB.getAllBalances(accountB.address);
    const ibcBalance = balancesB.find(b => b.denom.startsWith('ibc/'));

    expect(ibcBalance).toBeTruthy();
    expect(BigInt(ibcBalance!.amount)).toBe(1000000n);

    clientA.disconnect();
    clientB.disconnect();
  }, 60_000);
});
