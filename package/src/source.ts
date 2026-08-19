/** Run a high-level instance from a container image. */
export type ImageInstanceSource = {
  /** Container image reference. */
  image: string
  /** An image and a host binary select different runtimes. */
  binary?: never
}

/** Run a high-level instance from a local binary on `PATH`. */
export type BinaryInstanceSource = {
  /** Executable name or path. */
  binary: string
  /** An image and a host binary select different runtimes. */
  image?: never
}

/** Exactly one runtime source for an instance that has no built-in default. */
export type InstanceSource = ImageInstanceSource | BinaryInstanceSource

/**
 * An optional runtime source override for an instance with a built-in source.
 * Omitting both fields selects that definition's default source.
 */
export type OptionalInstanceSource =
  | InstanceSource
  | { image?: never; binary?: never }
