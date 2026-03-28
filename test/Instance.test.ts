import { describe, it, expect } from 'vitest';
import * as Instance from '../src/Instance.js';

/** Creates a fake instance that resolves start/stop via callbacks. */
function fakeInstance(options?: { startDelay?: number; stopDelay?: number }) {
  const { startDelay = 0, stopDelay = 0 } = options || {};

  let startCb: (() => void) | undefined;
  let stopCb: (() => void) | undefined;

  const instance = Instance.define((parameters?: { port?: number }) => ({
    name: 'fake',
    host: 'localhost',
    port: parameters?.port ?? 3000,
    async start(_opts, { emitter }) {
      await new Promise<void>(resolve => {
        if (startDelay > 0) {
          setTimeout(() => {
            emitter.emit('listening', undefined);
            resolve();
          }, startDelay);
        } else {
          startCb = () => {
            emitter.emit('listening', undefined);
            resolve();
          };
        }
      });
    },
    async stop() {
      await new Promise<void>(resolve => {
        if (stopDelay > 0) {
          setTimeout(resolve, stopDelay);
        } else {
          stopCb = resolve;
        }
      });
    },
  }));

  return {
    instance,
    resolveStart: () => startCb?.(),
    resolveStop: () => stopCb?.(),
  };
}

describe('Instance', () => {
  describe('define', () => {
    it('creates an instance with correct defaults', () => {
      const { instance } = fakeInstance();
      const inst = instance();
      expect(inst.name).toBe('fake');
      expect(inst.host).toBe('localhost');
      expect(inst.port).toBe(3000);
      expect(inst.status).toBe('idle');
    });

    it('accepts parameters', () => {
      const { instance } = fakeInstance();
      const inst = instance({ port: 4000 });
      expect(inst.port).toBe(4000);
    });
  });

  describe('lifecycle', () => {
    it('start → started', async () => {
      const { instance } = fakeInstance({ startDelay: 10 });
      const inst = instance();

      expect(inst.status).toBe('idle');
      const stopFn = await inst.start();
      expect(inst.status).toBe('started');
      expect(typeof stopFn).toBe('function');
    });

    it('stop → stopped', async () => {
      const { instance } = fakeInstance({ startDelay: 10, stopDelay: 10 });
      const inst = instance();

      await inst.start();
      expect(inst.status).toBe('started');

      await inst.stop();
      expect(inst.status).toBe('stopped');
    });

    it('restart cycles through stop → start', async () => {
      const { instance } = fakeInstance({ startDelay: 10, stopDelay: 10 });
      const inst = instance();

      await inst.start();
      expect(inst.status).toBe('started');

      await inst.restart();
      expect(inst.status).toBe('started');
    });

    it('throws when starting a non-idle/stopped instance', async () => {
      const { instance } = fakeInstance({ startDelay: 10 });
      const inst = instance();
      await inst.start();

      await expect(inst.start()).rejects.toThrow('not in an idle or stopped state');
    });

    it('throws when stopping a starting instance', async () => {
      const { instance, resolveStart } = fakeInstance();
      const inst = instance();

      const startPromise = inst.start();
      expect(inst.status).toBe('starting');

      await expect(inst.stop()).rejects.toThrow('is starting');

      resolveStart();
      await startPromise;
    });

    it('deduplicates concurrent start calls', async () => {
      const { instance } = fakeInstance({ startDelay: 50 });
      const inst = instance();

      const p1 = inst.start();
      const p2 = inst.start();

      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1).toBe(r2);
    });

    it('deduplicates concurrent stop calls', async () => {
      const { instance } = fakeInstance({ startDelay: 10, stopDelay: 50 });
      const inst = instance();
      await inst.start();

      const p1 = inst.stop();
      const p2 = inst.stop();
      await Promise.all([p1, p2]);

      expect(inst.status).toBe('stopped');
    });

    it('can restart after stop', async () => {
      const { instance } = fakeInstance({ startDelay: 10, stopDelay: 10 });
      const inst = instance();

      await inst.start();
      await inst.stop();
      expect(inst.status).toBe('stopped');

      await inst.start();
      expect(inst.status).toBe('started');
    });
  });

  describe('events', () => {
    it('emits message events', async () => {
      const messages: string[] = [];

      const instance = Instance.define(() => ({
        name: 'eventer',
        host: 'localhost',
        port: 3000,
        async start(_opts, { emitter }) {
          emitter.emit('message', 'hello');
          emitter.emit('message', 'world');
          emitter.emit('listening', undefined);
        },
        async stop() {},
      }));

      const inst = instance();
      inst.on('message', msg => messages.push(msg));
      await inst.start();

      expect(messages).toEqual(['hello', 'world']);
    });
  });

  describe('messages', () => {
    it('buffers messages', async () => {
      const instance = Instance.define(() => ({
        name: 'buffered',
        host: 'localhost',
        port: 3000,
        async start(_opts, { emitter }) {
          for (let i = 0; i < 5; i++) {
            emitter.emit('message', `msg-${i}`);
          }
          emitter.emit('listening', undefined);
        },
        async stop() {},
      }));

      const inst = instance();
      await inst.start();

      expect(inst.messages.get()).toEqual(['msg-0', 'msg-1', 'msg-2', 'msg-3', 'msg-4']);
    });

    it('respects messageBuffer limit', async () => {
      const instance = Instance.define(() => ({
        name: 'limited',
        host: 'localhost',
        port: 3000,
        async start(_opts, { emitter }) {
          for (let i = 0; i < 10; i++) {
            emitter.emit('message', `msg-${i}`);
          }
          emitter.emit('listening', undefined);
        },
        async stop() {},
      }));

      const inst = instance({ messageBuffer: 3 });
      await inst.start();

      expect(inst.messages.get()).toEqual(['msg-7', 'msg-8', 'msg-9']);
    });

    it('clears messages on stop', async () => {
      const instance = Instance.define(() => ({
        name: 'clearable',
        host: 'localhost',
        port: 3000,
        async start(_opts, { emitter }) {
          emitter.emit('message', 'test');
          emitter.emit('listening', undefined);
        },
        async stop() {},
      }));

      const inst = instance();
      await inst.start();
      expect(inst.messages.get().length).toBe(1);

      await inst.stop();
      expect(inst.messages.get()).toEqual([]);
    });
  });

  describe('timeout', () => {
    it('rejects start if timeout exceeded', async () => {
      const instance = Instance.define(() => ({
        name: 'slow',
        host: 'localhost',
        port: 3000,
        async start() {
          // Never resolves
          await new Promise(() => {});
        },
        async stop() {},
      }));

      const inst = instance({ timeout: 100 });
      await expect(inst.start()).rejects.toThrow('failed to start in time');
    });
  });
});
