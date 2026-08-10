import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createCommandRunner } from '../src/command.js'

function localRunner(signal: AbortSignal) {
  return createCommandRunner({
    binary: process.execPath,
    containerName: 'unused',
    name: 'node-test',
    signal,
  })
}

describe('local command runner', () => {
  it('passes stdin without blocking the event loop', async () => {
    const controller = new AbortController()
    const output = await localRunner(controller.signal).run(
      os.tmpdir(),
      ['-e', 'process.stdin.pipe(process.stdout)', '--'],
      { input: 'recovery phrase\n' },
    )

    expect(output.stdout).toBe('recovery phrase\n')
  })

  it('appends the selected home directory', async () => {
    const controller = new AbortController()
    const homeDir = path.join(os.tmpdir(), 'starskiff-command-home')
    const output = await localRunner(controller.signal).run(homeDir, [
      '-e',
      'process.stdout.write(process.argv.at(-1) ?? "")',
      '--',
    ])

    expect(output.stdout).toBe(homeDir)
  })

  it('terminates a one-shot command when startup is aborted', async () => {
    const controller = new AbortController()
    const operation = localRunner(controller.signal).run(os.tmpdir(), [
      '-e',
      'setInterval(() => {}, 1_000)',
      '--',
    ])

    const reason = new Error('startup timed out')
    controller.abort(reason)

    await expect(operation).rejects.toBe(reason)
  })
})
