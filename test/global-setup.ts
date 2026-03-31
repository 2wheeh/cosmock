import type { TestProject } from 'vitest/node';
import { Instance } from '../src/index.js';

const TEST_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

const RELAYER_MNEMONIC = 'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong';

export default async function setup({ provide }: TestProject) {
  const cleanups: (() => Promise<void>)[] = [];

  const simd = Instance.simd({
    chainId: 'cosmock-test-1',
    denom: 'stake',
    accounts: [{ mnemonic: TEST_MNEMONIC, coins: '1000000000stake', name: 'alice' }],
  });
  console.log('[global-setup] starting simd...');
  await simd.start();
  console.log('[global-setup] simd started');
  cleanups.push(() => simd.stop());

  const wasmd = Instance.wasmd({
    chainId: 'wasm-test-1',
    denom: 'stake',
    rpcPort: 26757,
    grpcPort: 9190,
    apiPort: 1417,
    p2pPort: 26756,
    grpcWebPort: 9191,
    pprofPort: 6160,
    accounts: [{ mnemonic: TEST_MNEMONIC, coins: '1000000000stake', name: 'alice' }],
  });
  console.log('[global-setup] starting wasmd...');
  await wasmd.start();
  console.log('[global-setup] wasmd started');
  cleanups.push(() => wasmd.stop());

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
  });

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
  });

  console.log('[global-setup] starting ibc chains...');
  await Promise.all([ibcChainA.start(), ibcChainB.start()]);
  console.log('[global-setup] ibc chains started');
  cleanups.push(() => ibcChainA.stop());
  cleanups.push(() => ibcChainB.stop());

  const relayer = Instance.hermes(
    {
      channels: [[ibcChainA, ibcChainB]],
      mnemonic: RELAYER_MNEMONIC,
    },
    { timeout: process.env.CI ? 600_000 : 180_000 },
  );

  const onRelayerMessage = (msg: string) => {
    if (msg.includes('[hermes-setup]')) {
      console.log(msg.trim());
    }
  };

  relayer.on('message', onRelayerMessage);

  console.log('[global-setup] starting hermes relayer...');
  try {
    await relayer.start();
  } finally {
    relayer.off('message', onRelayerMessage);
  }
  console.log('[global-setup] hermes relayer started');
  cleanups.push(() => relayer.stop());

  provide('simdRpcUrl', `http://localhost:${simd.port}`);
  provide('wasmdRpcUrl', `http://localhost:${wasmd.port}`);
  provide('ibcChainARpcUrl', `http://${ibcChainA.host}:${ibcChainA.port}`);
  provide('ibcChainBRpcUrl', `http://${ibcChainB.host}:${ibcChainB.port}`);
  provide('testMnemonic', TEST_MNEMONIC);

  return async () => {
    await Promise.all(cleanups.map(fn => fn()));
  };
}

declare module 'vitest' {
  export interface ProvidedContext {
    simdRpcUrl: string;
    wasmdRpcUrl: string;
    ibcChainARpcUrl: string;
    ibcChainBRpcUrl: string;
    testMnemonic: string;
  }
}
