#!/usr/bin/env node

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PACKAGE_DIRECTORY = path.join(ROOT, 'package')
const PNPM = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' })

  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited with status ${result.status}`)
  }
}

const temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), 'starskiff-package-'))

try {
  const artifactsDirectory = path.join(temporaryDirectory, 'artifacts')
  const consumerDirectory = path.join(temporaryDirectory, 'consumer')
  mkdirSync(artifactsDirectory)
  mkdirSync(consumerDirectory)

  run(PNPM, ['pack', '--pack-destination', artifactsDirectory], PACKAGE_DIRECTORY)

  const tarballs = readdirSync(artifactsDirectory).filter((entry) => entry.endsWith('.tgz'))
  assert.equal(tarballs.length, 1, `expected one packed tarball, found: ${tarballs.join(', ')}`)
  const tarballPath = path.join(artifactsDirectory, tarballs[0])

  const installedPackageDirectory = path.join(consumerDirectory, 'node_modules', 'starskiff')
  mkdirSync(installedPackageDirectory, { recursive: true })
  run(
    'tar',
    ['-xzf', tarballPath, '--strip-components=1', '-C', installedPackageDirectory],
    consumerDirectory,
  )

  const packedManifest = JSON.parse(
    readFileSync(path.join(installedPackageDirectory, 'package.json'), 'utf8'),
  )
  // Keep the consumer hermetic while preserving install semantics: only
  // dependencies declared by the packed manifest are made resolvable.
  for (const dependency of Object.keys(packedManifest.dependencies ?? {})) {
    const source = path.join(PACKAGE_DIRECTORY, 'node_modules', dependency)
    const target = path.join(consumerDirectory, 'node_modules', dependency)
    mkdirSync(path.dirname(target), { recursive: true })
    symlinkSync(source, target, process.platform === 'win32' ? 'junction' : 'dir')
  }

  const packageManifest = {
    private: true,
    type: 'module',
    dependencies: {
      starskiff: `file:../artifacts/${tarballs[0]}`,
    },
  }
  writeFileSync(
    path.join(consumerDirectory, 'package.json'),
    `${JSON.stringify(packageManifest, null, 2)}\n`,
  )

  writeFileSync(
    path.join(consumerDirectory, 'runtime.mjs'),
    `import assert from 'node:assert/strict'
import packageJson from 'starskiff/package.json' with { type: 'json' }
import { Instance, SIMD_DEFAULT_IMAGE, cosmosBase } from 'starskiff'

assert.equal(packageJson.name, 'starskiff')
assert.equal(packageJson.type, 'module')
assert.equal(typeof Instance.simd, 'function')
assert.equal(typeof cosmosBase, 'function')
assert.equal(typeof SIMD_DEFAULT_IMAGE, 'string')

const instance = Instance.simd({ chainId: 'packed-package-test' })
assert.equal(instance.name, 'simd')
assert.equal(instance.chainId, 'packed-package-test')
`,
  )

  writeFileSync(
    path.join(consumerDirectory, 'types.ts'),
    `import {
  Instance,
  SIMD_DEFAULT_IMAGE,
  type CosmosInstance,
  type SimdParameters,
} from 'starskiff'

const parameters = { chainId: 'packed-package-test' } satisfies SimdParameters
const instance: CosmosInstance = Instance.simd(parameters)
const status: Instance.InstanceStatus = instance.status
const image: string = SIMD_DEFAULT_IMAGE
const startResult: Promise<() => void> = instance.start()

void status
void image
void startResult
`,
  )

  writeFileSync(
    path.join(consumerDirectory, 'tsconfig.json'),
    `${JSON.stringify({
      compilerOptions: {
        lib: ['ES2024'],
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        noEmit: true,
        strict: true,
        target: 'ES2024',
        typeRoots: [path.join(PACKAGE_DIRECTORY, 'node_modules', '@types')],
        types: ['node'],
      },
      files: ['types.ts'],
    }, null, 2)}\n`,
  )

  run(process.execPath, ['runtime.mjs'], consumerDirectory)
  run(
    process.execPath,
    [path.join(PACKAGE_DIRECTORY, 'node_modules', 'typescript', 'bin', 'tsc'), '--project', 'tsconfig.json'],
    consumerDirectory,
  )

  console.log('Packed-package ESM and TypeScript acceptance checks passed.')
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true })
}
