/**
 * Shared configuration for GitHub Actions runner options.
 * Used by JobPropertyPanel and other components that need runs-on options.
 * Add more shared config here as duplicated variables are consolidated.
 */

export type RunnerIconType = 'linux' | 'mac' | 'windows' | 'server'

export interface RunnerOptionConfig {
  value: string
  label: string
  iconType: RunnerIconType
}

export const RUNNER_OPTIONS: RunnerOptionConfig[] = [
  { value: 'ubuntu-latest', label: 'Ubuntu Latest', iconType: 'linux' },
  { value: 'ubuntu-slim', label: 'Ubuntu Slim', iconType: 'linux' },
  { value: 'ubuntu-24.04', label: 'Ubuntu 24.04', iconType: 'linux' },
  { value: 'ubuntu-24.04-arm', label: 'Ubuntu 24.04 (ARM)', iconType: 'linux' },
  { value: 'ubuntu-22.04', label: 'Ubuntu 22.04', iconType: 'linux' },
  { value: 'ubuntu-22.04-arm', label: 'Ubuntu 22.04 (ARM)', iconType: 'linux' },
  { value: 'macos-latest', label: 'macOS Latest', iconType: 'mac' },
  { value: 'macos-26', label: 'macOS 26', iconType: 'mac' },
  { value: 'macos-26-intel', label: 'macOS 26 (Intel)', iconType: 'mac' },
  { value: 'macos-15', label: 'macOS 15', iconType: 'mac' },
  { value: 'macos-15-intel', label: 'macOS 15 (Intel)', iconType: 'mac' },
  { value: 'macos-14', label: 'macOS 14', iconType: 'mac' },
  { value: 'windows-latest', label: 'Windows Latest', iconType: 'windows' },
  { value: 'windows-2025', label: 'Windows 2025', iconType: 'windows' },
  { value: 'windows-2025-vs2026', label: 'Windows 2025 VS 2026 (preview)', iconType: 'windows' },
  { value: 'windows-11-arm', label: 'Windows 11 (ARM)', iconType: 'windows' },
  { value: 'windows-2022', label: 'Windows 2022', iconType: 'windows' },
  { value: 'self-hosted', label: 'Self-hosted', iconType: 'server' },
]
