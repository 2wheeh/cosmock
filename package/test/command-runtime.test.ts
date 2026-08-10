import { beforeEach, describe, expect, it, vi } from 'vitest'

const { xMock } = vi.hoisted(() => ({
  xMock: vi.fn(),
}))

vi.mock('tinyexec', () => ({ x: xMock }))

import { createCommandRunner } from '../src/command.js'

describe('container command runner environment', () => {
  beforeEach(() => {
    xMock.mockReset()
    xMock.mockResolvedValue({ stdout: '', stderr: '' })
  })

  it('injects runtime environment into the container without changing the Docker client environment', async () => {
    const runner = createCommandRunner({
      binary: 'marood',
      containerName: 'marood-test',
      image: 'maroo:local',
      name: 'marood',
      runtime: {
        environment: { STARSKIFF_CHAIN_ONLY: 'inside-container' },
      },
      signal: new AbortController().signal,
    })

    await runner.run('/tmp/chain', ['init', 'validator'])

    expect(xMock).toHaveBeenCalledOnce()
    const [command, args, options] = xMock.mock.calls[0] as [
      string,
      string[],
      { nodeOptions: { env: NodeJS.ProcessEnv } },
    ]
    expect(command).toBe('docker')
    expect(args).toContain('STARSKIFF_CHAIN_ONLY=inside-container')
    expect(options.nodeOptions.env).toBe(process.env)
    expect(options.nodeOptions.env.STARSKIFF_CHAIN_ONLY).toBeUndefined()
  })
})
