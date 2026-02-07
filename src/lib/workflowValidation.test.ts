import { describe, it, expect } from 'vitest'
import { validateWorkflowYaml } from './workflowValidation'

const validWorkflowYaml = `
name: Valid
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo hello
`

describe('validateWorkflowYaml', () => {
  it('returns no errors for valid workflow', () => {
    const errors = validateWorkflowYaml(validWorkflowYaml)
    expect(errors).toHaveLength(0)
  })

  it('returns errors for invalid YAML', () => {
    const errors = validateWorkflowYaml('not: valid: yaml: [')
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].severity).toBe('error')
    expect(errors[0].message).toBeTruthy()
  })

  it('returns errors when workflow has no jobs', () => {
    const yaml = `
name: No jobs
on: push
`
    const errors = validateWorkflowYaml(yaml)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors.some((e) => e.message.toLowerCase().includes('job'))).toBe(true)
  })

  it('returns errors when job is missing runs-on', () => {
    const yaml = `
name: No runs-on
on: push
jobs:
  build:
    steps:
      - run: echo hi
`
    const errors = validateWorkflowYaml(yaml)
    expect(errors.length).toBeGreaterThan(0)
    expect(
      errors.some((e) => e.message.toLowerCase().includes('runs-on'))
    ).toBe(true)
  })

  it('returns errors when step has neither run nor uses', () => {
    const yaml = `
name: Empty step
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: No run
`
    const errors = validateWorkflowYaml(yaml)
    expect(errors.length).toBeGreaterThan(0)
  })

  it('returns LintError shape with message and severity', () => {
    const yaml = `
on: push
jobs:
  build:
    steps: []
`
    const errors = validateWorkflowYaml(yaml)
    expect(errors.length).toBeGreaterThan(0)
    errors.forEach((e) => {
      expect(e).toHaveProperty('message')
      expect(typeof e.message).toBe('string')
      expect(e.severity).toBe('error')
    })
  })

  it('accepts optional filename', () => {
    const errors = validateWorkflowYaml(validWorkflowYaml, 'my-workflow.yml')
    expect(errors).toHaveLength(0)
  })
})
