import { describe, it, expect } from 'vitest'
import { RUNNER_OPTIONS } from './runnerConfig'

describe('RUNNER_OPTIONS', () => {
  it('includes common runners', () => {
    const values = RUNNER_OPTIONS.map((opt) => opt.value)
    expect(values).toContain('ubuntu-latest')
    expect(values).toContain('ubuntu-24.04')
    expect(values).toContain('ubuntu-24.04-arm')
    expect(values).toContain('macos-latest')
    expect(values).toContain('windows-latest')
    expect(values).toContain('self-hosted')
  })

  it('each option has value, label, and iconType', () => {
    for (const opt of RUNNER_OPTIONS) {
      expect(opt.value).toBeDefined()
      expect(opt.label).toBeDefined()
      expect(['linux', 'mac', 'windows', 'server']).toContain(opt.iconType)
    }
  })

  it('has no duplicate values', () => {
    const values = RUNNER_OPTIONS.map((opt) => opt.value)
    const unique = new Set(values)
    expect(unique.size).toBe(values.length)
  })
})
