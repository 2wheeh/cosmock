/**
 * Files and environment required by every invocation of a chain binary.
 *
 * This is an internal seam between cosmosBase and its Docker/local-process
 * adapters. Chain instance interfaces should expose domain-specific options
 * and translate them into this shape themselves.
 */
export type ExecutionDependency = {
  environment: Record<string, string>
  unsetEnvironment?: readonly string[]
  mounts?: readonly {
    source: string
    target: string
    readOnly: true
  }[]
}

/** Builds an isolated child environment without mutating the parent process. */
export function applyExecutionEnvironment(
  parent: NodeJS.ProcessEnv,
  dependency?: ExecutionDependency,
): NodeJS.ProcessEnv {
  if (!dependency) return parent

  const environment = { ...parent }
  for (const name of dependency.unsetEnvironment ?? []) delete environment[name]
  Object.assign(environment, dependency.environment)
  return environment
}
