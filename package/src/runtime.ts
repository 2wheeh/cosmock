/**
 * Environment and read-only files required by every invocation of a chain
 * binary. The local-process and Docker adapters translate these options into
 * their native invocation format.
 */
export type RuntimeOptions = {
  environment?: Readonly<Record<string, string>>
  unsetEnvironment?: readonly string[]
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
