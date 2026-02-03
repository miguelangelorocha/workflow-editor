import { describe, it, expect } from 'vitest'
import { openWorkflowFromYaml, validateWorkflow } from './fileHandling'
import type { Workflow } from '@/types/workflow'

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
