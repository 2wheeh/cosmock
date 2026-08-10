/**
 * Environment and read-only files required by chain commands. Environment
 * settings apply to both local processes and containers; mounts apply only to
 * containers.
 */
export type RuntimeOptions = {
  /** Explicit values. These take precedence over `unsetEnvironment`. */
  environment?: Readonly<Record<string, string>>
  /** Variables to remove unless an explicit value is also provided. */
  unsetEnvironment?: readonly string[]
  /** Read-only host directories mounted only when using a container image. */
  mounts?: readonly {
    source: string
    target: string
    readOnly: true
  }[]
}

/** Builds an isolated child environment without mutating the parent process. */
export function applyRuntimeEnvironment(
  parent: NodeJS.ProcessEnv,
  runtime?: RuntimeOptions,
): NodeJS.ProcessEnv {
  if (!runtime) return parent

  const environment = { ...parent }
  for (const name of runtime.unsetEnvironment ?? []) delete environment[name]
  Object.assign(environment, runtime.environment)
  return environment
}
