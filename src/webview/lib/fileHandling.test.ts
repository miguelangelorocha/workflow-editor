import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { openWorkflowFromYaml, validateWorkflow, getVscode, saveWorkflowToFile, requestOpenFile } from './fileHandling'
import { serializeWorkflow } from './serializeWorkflow'
import type { Workflow } from '@/types/workflow'

describe('comment preservation', () => {
  it('parse then serialize drops comments so original string is needed for source dialog', () => {
    const yamlWithComments = `# Build and test
name: CI
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo hi
`
    const { workflow, errors } = openWorkflowFromYaml(yamlWithComments)
    expect(errors).toEqual([])
    const serialized = serializeWorkflow(workflow)
    expect(serialized).not.toContain('# Build and test')
    expect(yamlWithComments).toContain('# Build and test')
    expect(serialized).toContain('name: CI')
  })

  it('when originalYaml is used as initialYaml it preserves comments', () => {
    const originalContent = `# Comment line
name: WithComment
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo ok
`
    const { workflow } = openWorkflowFromYaml(originalContent)
    const initialYaml = originalContent ?? serializeWorkflow(workflow)
    expect(initialYaml).toBe(originalContent)
    expect(initialYaml).toContain('# Comment line')
  })

})

describe('openWorkflowFromYaml', () => {
  it('returns workflow and errors from parseWorkflow', () => {
    const yaml = `
name: Test
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo hi
`
    const result = openWorkflowFromYaml(yaml)
    expect(result.errors).toEqual([])
    expect(result.workflow.name).toBe('Test')
    expect(result.workflow.jobs.build).toBeDefined()
  })

  it('returns errors for invalid YAML', () => {
    const result = openWorkflowFromYaml('invalid: [yaml:')
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.workflow.jobs).toEqual({})
  })
})

describe('validateWorkflow', () => {
  it('returns parse errors when workflow is serialized and re-parsed', () => {
    const workflow: Workflow = {
      name: 'Valid',
      on: 'push',
      jobs: {
        build: {
          'runs-on': 'ubuntu-latest',
          steps: [{ run: 'echo hi' }],
        },
      },
    }
    const errors = validateWorkflow(workflow)
    expect(errors).toEqual([])
  })

  it('returns empty array for valid workflow', () => {
    const workflow: Workflow = {
      name: 'X',
      on: 'push',
      jobs: {
        j: {
          'runs-on': 'ubuntu-latest',
          steps: [{ run: 'true' }],
        },
      },
    }
    expect(validateWorkflow(workflow)).toEqual([])
  })
})

describe('VSCode integration helpers', () => {
  let originalVscode: unknown
  let originalConsoleError: typeof console.error

  beforeEach(() => {
    const g = globalThis as unknown as { window?: { vscode?: unknown } }
    if (!g.window) {
      g.window = {}
    }
    originalVscode = g.window.vscode
    console.error = originalConsoleError
  })

  afterEach(() => {
    const g = globalThis as unknown as { window?: { vscode?: unknown } }
    if (!g.window) {
      g.window = {}
    }
    g.window.vscode = originalVscode
    console.error = originalConsoleError
    vi.restoreAllMocks()
  })

  it('getVscode returns undefined when vscode API is not present', () => {
    const g = globalThis as unknown as { window?: { vscode?: unknown } }
    g.window = {}
    expect(getVscode()).toBeUndefined()
  })

  it('getVscode returns vscode API when present', () => {
    const postMessage = vi.fn()
    const g = globalThis as unknown as { window?: { vscode?: unknown } }
    g.window = { vscode: { postMessage } }
    expect(getVscode()).toEqual({ postMessage })
  })

  it('saveWorkflowToFile posts saveFile command when vscode API is available', () => {
    const postMessage = vi.fn()
    const g = globalThis as unknown as { window?: { vscode?: unknown } }
    g.window = { vscode: { postMessage } }

    const workflow: Workflow = {
      name: 'Save test',
      on: 'push',
      jobs: {
        build: {
          'runs-on': 'ubuntu-latest',
          steps: [{ run: 'echo hi' }],
        },
      },
    }

    saveWorkflowToFile(workflow, 'custom.yml')

    expect(postMessage).toHaveBeenCalledTimes(1)
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'saveFile',
        filename: 'custom.yml',
      })
    )
    const payload = postMessage.mock.calls[0][0] as { content: string }
    expect(typeof payload.content).toBe('string')
    expect(payload.content).toContain('name: Save test')
  })

  it('saveWorkflowToFile with content argument sends that content', () => {
    const postMessage = vi.fn()
    const g = globalThis as unknown as { window?: { vscode?: unknown } }
    g.window = { vscode: { postMessage } }

    const workflow: Workflow = {
      name: 'X',
      on: 'push',
      jobs: {
        build: {
          'runs-on': 'ubuntu-latest',
          steps: [{ run: 'echo hi' }],
        },
      },
    }
    const contentWithComment =
      '# Preserved comment\nname: X\non: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo hi\n'

    saveWorkflowToFile(workflow, 'out.yml', contentWithComment)

    expect(postMessage).toHaveBeenCalledTimes(1)
    const payload = postMessage.mock.calls[0][0] as { content: string }
    expect(payload.content).toBe(contentWithComment)
    expect(payload.content).toContain('# Preserved comment')
  })

  it('saveWorkflowToFile logs error when vscode API is missing', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const g = globalThis as unknown as { window?: { vscode?: unknown } }
    g.window = {}

    const workflow: Workflow = {
      name: 'No vscode',
      on: 'push',
      jobs: {
        build: {
          'runs-on': 'ubuntu-latest',
          steps: [{ run: 'echo hi' }],
        },
      },
    }

    saveWorkflowToFile(workflow, 'no-vscode.yml')

    expect(consoleSpy).toHaveBeenCalledTimes(1)
    expect(consoleSpy.mock.calls[0][0]).toMatch(/VSCode API not available/i)
  })

  it('requestOpenFile posts openFile command when vscode API is available', () => {
    const postMessage = vi.fn()
    const g = globalThis as unknown as { window?: { vscode?: unknown } }
    g.window = { vscode: { postMessage } }

    requestOpenFile()

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'openFile',
      })
    )
  })

  it('requestOpenFile logs error when vscode API is missing', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const g = globalThis as unknown as { window?: { vscode?: unknown } }
    g.window = {}

    requestOpenFile()

    expect(consoleSpy).toHaveBeenCalledTimes(1)
    expect(consoleSpy.mock.calls[0][0]).toMatch(/VSCode API not available/i)
  })
})
