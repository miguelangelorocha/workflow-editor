import { describe, it, expect } from 'vitest'
import { lintWorkflow } from './workflowLinter'
import { parseWorkflow } from './parseWorkflow'
import type { Workflow } from '@/types/workflow'

const validWorkflowYaml = `
name: Valid
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo hello
`

describe('lintWorkflow', () => {
  it('returns no errors for valid workflow', () => {
    const { workflow } = parseWorkflow(validWorkflowYaml)
    const errors = lintWorkflow(workflow)
    expect(errors).toHaveLength(0)
  })

  it('errors when workflow has no trigger (empty on)', () => {
    const workflow: Workflow = {
      name: 'No trigger',
      on: {},
      jobs: {
        build: {
          'runs-on': 'ubuntu-latest',
          steps: [{ run: 'echo hi' }],
        },
      },
    }
    const errors = lintWorkflow(workflow)
    expect(errors.some((e) => e.message.includes('at least one trigger'))).toBe(
      true
    )
  })

  it('errors when workflow has no jobs', () => {
    const workflow: Workflow = {
      name: 'No jobs',
      on: 'push',
      jobs: {},
    }
    const errors = lintWorkflow(workflow)
    expect(errors.some((e) => e.message.includes('at least one job'))).toBe(
      true
    )
  })

  it('errors when job is missing runs-on', () => {
    const workflow: Workflow = {
      name: 'No runs-on',
      on: 'push',
      jobs: {
        build: {
          steps: [{ run: 'echo hi' }],
        } as Workflow['jobs'][string],
      },
    }
    const errors = lintWorkflow(workflow)
    expect(
      errors.some((e) => e.message.includes('runs-on') && e.path?.includes('runs-on'))
    ).toBe(true)
  })

  it('errors when job needs non-existent job', () => {
    const workflow: Workflow = {
      name: 'Bad needs',
      on: 'push',
      jobs: {
        two: {
          'runs-on': 'ubuntu-latest',
          needs: 'one',
          steps: [{ run: 'echo two' }],
        },
      },
    }
    const errors = lintWorkflow(workflow)
    expect(
      errors.some((e) => e.message.includes('depends on job "one" which does not exist'))
    ).toBe(true)
  })

  it('errors when step has neither run nor uses', () => {
    const workflow: Workflow = {
      name: 'Empty step',
      on: 'push',
      jobs: {
        build: {
          'runs-on': 'ubuntu-latest',
          steps: [{ name: 'No run' }],
        },
      },
    }
    const errors = lintWorkflow(workflow)
    expect(
      errors.some((e) => e.message.includes('must have either "run" or "uses"'))
    ).toBe(true)
  })

  it('errors when step has both run and uses', () => {
    const workflow: Workflow = {
      name: 'Both run and uses',
      on: 'push',
      jobs: {
        build: {
          'runs-on': 'ubuntu-latest',
          steps: [
            { run: 'echo hi', uses: 'actions/checkout@v4' },
          ],
        },
      },
    }
    const errors = lintWorkflow(workflow)
    expect(
      errors.some((e) => e.message.includes('cannot have both "run" and "uses"'))
    ).toBe(true)
  })

  it('detects circular dependency', () => {
    const workflow: Workflow = {
      name: 'Cycle',
      on: 'push',
      jobs: {
        a: {
          'runs-on': 'ubuntu-latest',
          needs: 'c',
          steps: [{ run: 'echo a' }],
        },
        b: {
          'runs-on': 'ubuntu-latest',
          needs: 'a',
          steps: [{ run: 'echo b' }],
        },
        c: {
          'runs-on': 'ubuntu-latest',
          needs: 'b',
          steps: [{ run: 'echo c' }],
        },
      },
    }
    const errors = lintWorkflow(workflow)
    expect(
      errors.some((e) => e.message.includes('Circular dependency'))
    ).toBe(true)
  })

  it('errors for invalid trigger event', () => {
    const workflow: Workflow = {
      name: 'Bad trigger',
      on: 'invalid_event_xyz',
      jobs: {
        build: {
          'runs-on': 'ubuntu-latest',
          steps: [{ run: 'echo hi' }],
        },
      },
    }
    const errors = lintWorkflow(workflow)
    expect(
      errors.some((e) => e.message.includes('Invalid trigger event'))
    ).toBe(true)
  })

  it('errors for schedule without cron', () => {
    const workflow: Workflow = {
      name: 'Schedule no cron',
      on: { schedule: [{}] },
      jobs: {
        build: {
          'runs-on': 'ubuntu-latest',
          steps: [{ run: 'echo hi' }],
        },
      },
    }
    const errors = lintWorkflow(workflow)
    expect(
      errors.some((e) => e.message.includes('schedule') && e.message.includes('cron'))
    ).toBe(true)
  })

  it('errors for invalid cron format', () => {
    const workflow: Workflow = {
      name: 'Bad cron',
      on: { schedule: [{ cron: 'not-five-parts' }] },
      jobs: {
        build: {
          'runs-on': 'ubuntu-latest',
          steps: [{ run: 'echo hi' }],
        },
      },
    }
    const errors = lintWorkflow(workflow)
    expect(
      errors.some((e) => e.message.includes('Invalid cron') || e.message.includes('cron'))
    ).toBe(true)
  })

  it('warns for empty matrix', () => {
    const workflow: Workflow = {
      name: 'Empty matrix',
      on: 'push',
      jobs: {
        build: {
          'runs-on': 'ubuntu-latest',
          strategy: { matrix: {} },
          steps: [{ run: 'echo hi' }],
        },
      },
    }
    const errors = lintWorkflow(workflow)
    expect(
      errors.some((e) => e.message.includes('empty matrix'))
    ).toBe(true)
  })

  it('validates workflow_run requires workflows', () => {
    const workflow: Workflow = {
      name: 'Workflow run',
      on: { workflow_run: {} },
      jobs: {
        build: {
          'runs-on': 'ubuntu-latest',
          steps: [{ run: 'echo hi' }],
        },
      },
    }
    const errors = lintWorkflow(workflow)
    expect(
      errors.some((e) => e.message.includes('workflow_run') && e.message.includes('workflows'))
    ).toBe(true)
  })
})
