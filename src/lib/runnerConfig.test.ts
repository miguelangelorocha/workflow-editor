import { describe, it, expect } from 'vitest'
import { RUNNER_OPTIONS } from '@/lib/runnerConfig'

const ALLOWED_RUNNERS = [
  'ubuntu-latest',
  'ubuntu-slim',
  'ubuntu-24.04',
  'ubuntu-24.04-arm',
  'ubuntu-22.04',
  'ubuntu-22.04-arm',
  'macos-latest',
  'macos-26',
  'macos-26-intel',
  'macos-15',
  'macos-15-intel',
  'macos-14',
  'windows-latest',
  'windows-2025',
  'windows-2025-vs2026',
  'windows-11-arm',
  'windows-2022',
  'self-hosted',
] as const

const DEPRECATED_RUNNERS = ['windows-2019', 'macos-13', 'macos-12', 'ubuntu-20.04'] as const

describe('RUNNER_OPTIONS', () => {
  it('includes all allowed runners and excludes deprecated ones', () => {
    const values = RUNNER_OPTIONS.map((opt) => opt.value)
    for (const runner of ALLOWED_RUNNERS) {
      expect(values).toContain(runner)
    }
    for (const runner of DEPRECATED_RUNNERS) {
      expect(values).not.toContain(runner)
    }
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
