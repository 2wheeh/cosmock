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

  const wasmA = Instance.wasmd({
    chainId: 'ibc-wasm-a',
    prefix: 'wasm',
    rpcPort: 26757,
    grpcPort: 9190,
    apiPort: 1417,
    p2pPort: 26756,
    grpcWebPort: 9191,
    pprofPort: 6160,
    accounts: [
      { mnemonic: TEST_MNEMONIC, coins: '1000000000stake', name: 'alice' },
      { mnemonic: RELAYER_MNEMONIC, coins: '1000000000stake', name: 'relayer' },
    ],
  });

  const wasmB = Instance.wasmd({
    chainId: 'ibc-wasm-b',
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

  const gaia = Instance.gaiad({
    chainId: 'ibc-cosmos-1',
    denom: 'uatom',
    rpcPort: 26957,
    grpcPort: 9390,
    apiPort: 1617,
    p2pPort: 26956,
    grpcWebPort: 9391,
    pprofPort: 6360,
    accounts: [
      { mnemonic: TEST_MNEMONIC, coins: '1000000000uatom', name: 'alice' },
      { mnemonic: RELAYER_MNEMONIC, coins: '1000000000uatom', name: 'relayer' },
    ],
  });

  console.log('[global-setup] starting ibc chains...');
  await Promise.all([wasmA.start(), wasmB.start(), gaia.start()]);
  console.log('[global-setup] ibc chains started');
  cleanups.push(() => wasmA.stop());
  cleanups.push(() => wasmB.stop());
  cleanups.push(() => gaia.stop());

  const relayer = Instance.hermes(
    {
      channels: [[wasmA, wasmB], [wasmA, gaia], [wasmB, gaia]],
      mnemonic: RELAYER_MNEMONIC,
    },
    { timeout: process.env.CI ? 300_000 : 180_000 },
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
  provide('wasmARpcUrl', `http://${wasmA.host}:${wasmA.port}`);
  provide('wasmBRpcUrl', `http://${wasmB.host}:${wasmB.port}`);
  provide('gaiaRpcUrl', `http://${gaia.host}:${gaia.port}`);
  provide('testMnemonic', TEST_MNEMONIC);

  return async () => {
    await Promise.all(cleanups.map(fn => fn()));
  };
}

declare module 'vitest' {
  export interface ProvidedContext {
    simdRpcUrl: string;
    wasmARpcUrl: string;
    wasmBRpcUrl: string;
    gaiaRpcUrl: string;
    testMnemonic: string;
  }
}
