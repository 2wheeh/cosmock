import { x, type Output } from 'tinyexec'
import {
  assertDockerAvailable,
  ensureImage,
  removeContainer,
  runArgs as dockerRunArgs,
  startArgs as dockerStartArgs,
} from './docker.js'
import {
  applyExecutionEnvironment,
  type ExecutionDependency,
} from './execution.js'
import { createProcess, type ProcessStartOptions } from './process.js'

type CommandRunnerOptions = {
  binary: string
  containerName: string
  executionDependency?: ExecutionDependency
  image?: string
  name: string
  signal: AbortSignal
}

type RunOptions = {
  input?: string
}

type StartOptions = ProcessStartOptions & {
  ports: number[]
}

/** Internal adapter shared by the local-binary and Docker runtimes. */
export type CommandRunner = {
  prepare(onMessage: (message: string) => void): Promise<void>
  run(homeDir: string, args: string[], options?: RunOptions): Promise<Output>
  start(homeDir: string, args: string[], options: StartOptions): Promise<void>
  stop(): Promise<void>
}

export function createCommandRunner(options: CommandRunnerOptions): CommandRunner {
  const {
    binary,
    containerName,
    executionDependency,
    image,
    name,
    signal,
  } = options
  const environment = applyExecutionEnvironment(process.env, executionDependency)
  const managedProcess = createProcess(name)
  const dockerOptions = (homeDir: string) => ({
    image: image!,
    homeDir,
    executionDependency,
  })

  const oneShotCommand = (homeDir: string, args: string[], interactive = false) =>
    image
      ? {
          command: 'docker',
          args: dockerRunArgs(dockerOptions(homeDir), binary, args, { interactive }),
        }
      : {
          command: binary,
          args: [...args, '--home', homeDir],
        }

  return {
    async prepare(onMessage) {
      if (!image) return
      await assertDockerAvailable(image, signal)
      await ensureImage(image, onMessage, signal)
    },

    async run(homeDir, args, runOptions = {}) {
      signal.throwIfAborted()
      const invocation = oneShotCommand(homeDir, args, runOptions.input !== undefined)
      const result = x(invocation.command, invocation.args, {
        signal,
        throwOnError: true,
        nodeOptions: { stdio: 'pipe', env: environment },
      })
      if (runOptions.input !== undefined) result.process?.stdin?.end(runOptions.input)
      const output = await result
      signal.throwIfAborted()
      return output
    },

    start(homeDir, args, { ports, ...startOptions }) {
      const invocation = image
        ? {
            command: 'docker',
            args: dockerStartArgs(dockerOptions(homeDir), binary, args, {
              name: containerName,
              ports,
            }),
          }
        : {
            command: binary,
            args: [...args, '--home', homeDir],
          }

      return managedProcess.start(invocation.command, invocation.args, {
        ...startOptions,
        environment,
        signal,
      })
    },

    async stop() {
      try {
        await managedProcess.stop()
      } finally {
        if (image) await removeContainer(containerName)
      }
    },
  }
}
