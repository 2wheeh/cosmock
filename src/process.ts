import { exec } from 'tinyexec';
import type { Emitter } from 'mitt';

import { stripColors } from './utils.js';

export type EventTypes = {
  exit: number | null;
  listening: undefined;
  message: string;
  stderr: string;
  stdout: string;
};

export type ProcessResolverOptions = {
  process: ReturnType<typeof exec>;
  resolve(): void;
  reject(reason: string): Promise<void>;
};

export type ProcessStartOptions = {
  emitter: Emitter<EventTypes>;
  resolver(options: ProcessResolverOptions): void;
};

export type Process = {
  start(command: string, args: string[], options: ProcessStartOptions): Promise<void>;
  stop(): Promise<void>;
};

/**
 * Creates a managed child process wrapper using tinyexec.
 *
 * Handles spawning, stdout/stderr forwarding to the emitter,
 * and graceful shutdown via SIGTERM.
 */
export function createProcess(name: string): Process {
  let child: ReturnType<typeof exec> | undefined;
  const errorMessages: string[] = [];

  return {
    start(command, args, { emitter, resolver }) {
      const { promise, resolve, reject } = Promise.withResolvers<void>();

      child = exec(command, args, {
        nodeOptions: { stdio: 'pipe' },
      });

      const proc = child.process!;

      async function kill() {
        proc.kill('SIGTERM');
        await new Promise<void>(r => proc.on('close', r));
      }

      resolver({
        process: child,
        resolve() {
          emitter.emit('listening', undefined);
          resolve();
        },
        async reject(reason) {
          await kill();
          reject(new Error(`Failed to start "${name}": ${reason}`));
        },
      });

      proc.stdout?.on('data', (data: Buffer) => {
        const message = stripColors(data.toString());
        emitter.emit('message', message);
        emitter.emit('stdout', message);
      });

      proc.stderr?.on('data', (data: Buffer) => {
        const message = stripColors(data.toString());
        errorMessages.push(message);
        if (errorMessages.length > 20) errorMessages.shift();
        emitter.emit('message', message);
        emitter.emit('stderr', message);
      });

      proc.on('exit', code => {
        emitter.emit('exit', code);
      });

      return promise;
    },

    async stop() {
      if (!child) return;
      const proc = child.process;
      if (!proc || proc.exitCode !== null) return;
      proc.kill('SIGTERM');
      await new Promise<void>(resolve => proc.on('close', resolve));
      child = undefined;
    },
  };
}
