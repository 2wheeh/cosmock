import net from 'node:net';
import { describe, expect, it, vi } from 'vitest';
import { findFreePorts } from '../src/index.js';

describe('findFreePorts', () => {
  it('returns distinct ports', async () => {
    const ports = await findFreePorts();
    const values = [
      ports.rpcPort,
      ports.grpcPort,
      ports.apiPort,
      ports.p2pPort,
      ports.grpcWebPort,
      ports.pprofPort,
    ];

    expect(new Set(values).size).toBe(values.length);
    expect(ports.evmPort).toBeUndefined();
  });

  it('returns ports that are all bindable', async () => {
    const ports = await findFreePorts();
    const values = [
      ports.rpcPort,
      ports.grpcPort,
      ports.apiPort,
      ports.p2pPort,
      ports.grpcWebPort,
      ports.pprofPort,
    ];

    for (const port of values) {
      await new Promise<void>((resolve, reject) => {
        const server = net.createServer();
        server.on('error', reject);
        server.listen(port, () => {
          server.close(() => resolve());
        });
      });
    }
  });

  it('adds a distinct evmPort when opts.evm is set', async () => {
    const ports = await findFreePorts({ evm: true });
    const values = [
      ports.rpcPort,
      ports.grpcPort,
      ports.apiPort,
      ports.p2pPort,
      ports.grpcWebPort,
      ports.pprofPort,
      ports.evmPort,
    ];

    expect(ports.evmPort).toBeTypeOf('number');
    expect(new Set(values).size).toBe(values.length);
  });

  it('closes ports grabbed before a later allocation fails', async () => {
    const successfulServer = (port: number) => {
      const close = vi.fn((callback?: () => void) => {
        callback?.();
        return server;
      });
      const server = {
        on() { return server; },
        listen(_port: number, callback?: () => void) {
          queueMicrotask(() => callback?.());
          return server;
        },
        address() { return { address: '127.0.0.1', family: 'IPv4', port }; },
        close,
      } as unknown as net.Server;
      return { close, server };
    };

    const first = successfulServer(40_001);
    const second = successfulServer(40_002);
    let rejectListen: ((error: Error) => void) | undefined;
    const failingServer = {
      on(event: string, handler: (error: Error) => void) {
        if (event === 'error') rejectListen = handler;
        return failingServer;
      },
      listen() {
        queueMicrotask(() => rejectListen?.(new Error('forced bind failure')));
        return failingServer;
      },
    } as unknown as net.Server;

    const createServer = vi.spyOn(net, 'createServer')
      .mockReturnValueOnce(first.server)
      .mockReturnValueOnce(second.server)
      .mockReturnValueOnce(failingServer);

    try {
      await expect(findFreePorts()).rejects.toThrow('forced bind failure');
      expect(first.close).toHaveBeenCalledOnce();
      expect(second.close).toHaveBeenCalledOnce();
    } finally {
      createServer.mockRestore();
    }
  });
});
