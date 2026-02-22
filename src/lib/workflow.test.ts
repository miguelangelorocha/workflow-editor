import { describe, it, expect } from 'vitest'
import { parseWorkflow } from './parseWorkflow'
import { serializeWorkflow } from './serializeWorkflow'
import { isReusableCallerJob } from '@/types/workflow'

const minimalWorkflow = `
name: Minimal
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo hello
`

const workflowWithNeeds = `
name: With Needs
on: [push, pull_request]
jobs:
  one:
    runs-on: ubuntu-latest
    steps:
      - run: echo one
  two:
    needs: one
    runs-on: ubuntu-latest
    steps:
      - run: echo two
`

const workflowWithSteps = `
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    name: Deploy
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 24
      - name: Build
        run: pnpm build
`

describe('parseWorkflow', () => {
  it('parses minimal workflow', () => {
    const { workflow, errors } = parseWorkflow(minimalWorkflow)
    expect(errors).toEqual([])
    expect(workflow.name).toBe('Minimal')
    expect(workflow.on).toBeDefined()
    expect(Object.keys(workflow.jobs)).toContain('build')
    expect(workflow.jobs.build['runs-on']).toBe('ubuntu-latest')
    expect(workflow.jobs.build.steps).toHaveLength(1)
    expect(workflow.jobs.build.steps[0].run).toBe('echo hello')
  })

  it('parses workflow with needs', () => {
    const { workflow, errors } = parseWorkflow(workflowWithNeeds)
    expect(errors).toEqual([])
    expect(workflow.jobs.one).toBeDefined()
    expect(workflow.jobs.two).toBeDefined()
    expect(workflow.jobs.two.needs).toBe('one')
  })

  it('parses workflow with uses and with', () => {
    const { workflow, errors } = parseWorkflow(workflowWithSteps)
    expect(errors).toEqual([])
    const steps = workflow.jobs.deploy.steps
    expect(steps[0].uses).toBe('actions/checkout@v4')
    expect(steps[1].name).toBe('Setup Node')
    expect(steps[1].uses).toBe('actions/setup-node@v4')
    expect(steps[1].with).toEqual({ 'node-version': 24 })
    expect(steps[2].run).toBe('pnpm build')
  })

  it('returns errors for invalid YAML', () => {
    const { errors } = parseWorkflow('not: valid: yaml: [')
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0]).toMatch(/YAML|parse|error/i)
  })

  it('returns errors when jobs is missing', () => {
    const { workflow, errors } = parseWorkflow('name: No jobs\non: push\n')
    expect(errors.some((e) => e.includes('jobs'))).toBe(true)
    expect(workflow.jobs).toEqual({})
  })

  it('returns invalid workflow error for non-object root', () => {
    const { workflow, errors } = parseWorkflow('42')
    expect(errors).toContain('Invalid workflow: root must be an object')
    expect(workflow.jobs).toEqual({})
  })

  it('parses job with strategy matrix', () => {
    const yaml = `
name: Matrix
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: [18, 20]
      fail-fast: false
    steps:
      - run: echo build
`
    const { workflow, errors } = parseWorkflow(yaml)
    expect(errors).toEqual([])
    expect(workflow.jobs.build.strategy?.matrix).toEqual({ node: [18, 20] })
    expect(workflow.jobs.build.strategy?.['fail-fast']).toBe(false)
  })

  it('normalizes invalid job entry to error', () => {
    const yaml = `
name: Bad job
on: push
jobs:
  good:
    runs-on: ubuntu-latest
    steps:
      - run: echo ok
  bad: "not an object"
`
    const { workflow, errors } = parseWorkflow(yaml)
    expect(errors.some((e) => e.includes('Job "bad"'))).toBe(true)
    expect(workflow.jobs.good).toBeDefined()
    expect(workflow.jobs.bad).toBeUndefined()
  })

  it('normalizes non-object steps into default step shape', () => {
    const yaml = `
name: Weird steps
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - "just a string"
      - 42
      - {}
`
    const { workflow, errors } = parseWorkflow(yaml)
    expect(errors).toEqual([])
    const steps = workflow.jobs.build.steps
    // First two entries should be normalized with generated names and empty run
    expect(steps[0]).toMatchObject({ name: 'Step 1', run: '' })
    expect(steps[1]).toMatchObject({ name: 'Step 2', run: '' })
    // Third entry should preserve object shape while still being a valid step
    expect(steps[2]).toHaveProperty('run')
  })

  it('normalizes non-string run-name to undefined', () => {
    // run-name as a number → FALSE branch of typeof check → normalized to undefined
    const yaml = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo hi
run-name: 42
`
    const { workflow } = parseWorkflow(yaml)
    expect(workflow['run-name']).toBeUndefined()
  })

  it('normalizes job with non-array steps to empty array', () => {
    const yaml = `
name: Null steps
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps: null
`
    const { workflow, errors } = parseWorkflow(yaml)
    expect(errors).toEqual([])
    expect(workflow.jobs.build.steps).toEqual([])
  })

  it('evaluates step env type guard for non-object env value', () => {
    // normalizeStep evaluates the FALSE branch of the env type guard for a string value.
    // The subsequent ...step spread still copies the raw value through, so the step
    // preserves the original env rather than converting it to undefined.
    const yaml = `
name: Bad step env
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo hi
        env: "not-an-object"
`
    const { workflow, errors } = parseWorkflow(yaml)
    expect(errors).toEqual([])
    // The type guard branch is exercised; the spread preserves the raw YAML value
    expect(workflow.jobs.build.steps[0].env).toBe('not-an-object')
  })

  it('parses job with permissions object', () => {
    const yaml = `
name: Permissions
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      issues: write
    steps:
      - run: echo hi
`
    const { workflow, errors } = parseWorkflow(yaml)
    expect(errors).toEqual([])
    expect(workflow.jobs.build.permissions).toEqual({ contents: 'read', issues: 'write' })
  })

  it('parses job with if condition', () => {
    const yaml = `
name: Conditional
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    if: "github.event_name == 'push'"
    steps:
      - run: echo hi
`
    const { workflow, errors } = parseWorkflow(yaml)
    expect(errors).toEqual([])
    expect(workflow.jobs.build.if).toBe("github.event_name == 'push'")
  })

  it('parses reusable job without with field', () => {
    const yaml = `
name: Reusable No With
on: push
jobs:
  call:
    uses: org/repo/.github/workflows/ci.yml@main
    secrets: inherit
`
    const { workflow, errors } = parseWorkflow(yaml)
    expect(errors).toEqual([])
    expect(workflow.jobs.call.uses).toBe('org/repo/.github/workflows/ci.yml@main')
    expect(workflow.jobs.call.with).toBeUndefined()
    expect(workflow.jobs.call.secrets).toBe('inherit')
  })

  it('parses reusable job with secrets as a map', () => {
    const yaml = `
name: Reusable Secrets Map
on: push
jobs:
  call:
    uses: org/repo/.github/workflows/ci.yml@main
    secrets:
      MY_SECRET: \${{ secrets.MY_TOKEN }}
`
    const { workflow, errors } = parseWorkflow(yaml)
    expect(errors).toEqual([])
    expect(workflow.jobs.call.secrets).toEqual({ MY_SECRET: '${{ secrets.MY_TOKEN }}' })
  })

  it('parses reusable job with no secrets', () => {
    const yaml = `
name: Reusable No Secrets
on: push
jobs:
  call:
    uses: org/repo/.github/workflows/ci.yml@main
`
    const { workflow, errors } = parseWorkflow(yaml)
    expect(errors).toEqual([])
    expect(workflow.jobs.call.uses).toBe('org/repo/.github/workflows/ci.yml@main')
    expect(workflow.jobs.call.secrets).toBeUndefined()
  })
})

describe('serializeWorkflow', () => {
  it('serializes minimal workflow to valid YAML', () => {
    const { workflow } = parseWorkflow(minimalWorkflow)
    const yaml = serializeWorkflow(workflow)
    expect(yaml).toContain('name: Minimal')
    expect(yaml).toContain('runs-on: ubuntu-latest')
    expect(yaml).toContain('echo hello')
  })

  it('round-trips minimal workflow', () => {
    const { workflow } = parseWorkflow(minimalWorkflow)
    const yaml = serializeWorkflow(workflow)
    const { workflow: again, errors } = parseWorkflow(yaml)
    expect(errors).toEqual([])
    expect(again.name).toBe(workflow.name)
    expect(again.jobs.build.steps[0].run).toBe(workflow.jobs.build.steps[0].run)
  })

  it('round-trips workflow with needs', () => {
    const { workflow } = parseWorkflow(workflowWithNeeds)
    const yaml = serializeWorkflow(workflow)
    const { workflow: again, errors } = parseWorkflow(yaml)
    expect(errors).toEqual([])
    expect(again.jobs.two.needs).toBe('one')
  })

  it('round-trips workflow with steps (uses, with)', () => {
    const { workflow } = parseWorkflow(workflowWithSteps)
    const yaml = serializeWorkflow(workflow)
    const { workflow: again, errors } = parseWorkflow(yaml)
    expect(errors).toEqual([])
    expect(again.jobs.deploy.steps[1].with).toEqual({ 'node-version': 24 })
    expect(again.jobs.deploy.steps[2].run).toBe('pnpm build')
  })

  it('serializes workflow with strategy', () => {
    const { workflow } = parseWorkflow(minimalWorkflow)
    workflow.jobs.build.strategy = {
      matrix: { node: ['18', '20'] },
      'fail-fast': true,
      'max-parallel': 3,
    }
    const yaml = serializeWorkflow(workflow)
    expect(yaml).toContain('matrix')
    expect(yaml).toContain('fail-fast')
    expect(yaml).toContain('max-parallel')
    const { workflow: again } = parseWorkflow(yaml)
    expect(again.jobs.build.strategy?.matrix).toEqual({ node: ['18', '20'] })
    expect(again.jobs.build.strategy?.['fail-fast']).toBe(true)
    expect(again.jobs.build.strategy?.['max-parallel']).toBe(3)
  })

  it('serializes workflow without a name', () => {
    const { workflow } = parseWorkflow('on: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo hi\n')
    expect(workflow.name).toBeUndefined()
    const yaml = serializeWorkflow(workflow)
    expect(yaml).not.toMatch(/^name:/m)
    expect(yaml).toContain('runs-on: ubuntu-latest')
  })

  it('serializes step with env values', () => {
    const { workflow } = parseWorkflow(minimalWorkflow)
    workflow.jobs.build.steps[0] = {
      run: 'echo hi',
      env: { MY_VAR: 'hello' },
    }
    const yaml = serializeWorkflow(workflow)
    expect(yaml).toContain('MY_VAR')
    const { workflow: again } = parseWorkflow(yaml)
    expect(again.jobs.build.steps[0].env).toEqual({ MY_VAR: 'hello' })
  })

  it('serializes strategy with only fail-fast (no matrix)', () => {
    const { workflow } = parseWorkflow(minimalWorkflow)
    workflow.jobs.build.strategy = { 'fail-fast': false }
    const yaml = serializeWorkflow(workflow)
    expect(yaml).toContain('fail-fast')
    expect(yaml).not.toContain('matrix')
  })

  it('serializes strategy with only max-parallel', () => {
    const { workflow } = parseWorkflow(minimalWorkflow)
    workflow.jobs.build.strategy = { 'max-parallel': 2 }
    const yaml = serializeWorkflow(workflow)
    expect(yaml).toContain('max-parallel')
  })

  it('serializes workflow with run-name', () => {
    const { workflow } = parseWorkflow(minimalWorkflow)
    workflow['run-name'] = 'Deploy ${{ github.sha }}'
    const yaml = serializeWorkflow(workflow)
    expect(yaml).toContain('run-name')
  })

  it('serializes workflow with top-level env', () => {
    const { workflow } = parseWorkflow(minimalWorkflow)
    workflow.env = { NODE_ENV: 'production' }
    const yaml = serializeWorkflow(workflow)
    expect(yaml).toContain('NODE_ENV')
    const { workflow: again } = parseWorkflow(yaml)
    expect(again.env).toEqual({ NODE_ENV: 'production' })
  })

  it('does not serialize strategy when matrix is empty and no other fields set', () => {
    const { workflow } = parseWorkflow(minimalWorkflow)
    // Strategy with only an empty matrix — nothing gets added to strategyObj
    workflow.jobs.build.strategy = { matrix: {} }
    const yaml = serializeWorkflow(workflow)
    // The empty strategy should be omitted from the output
    expect(yaml).not.toContain('strategy')
  })

  it('round-trips a reusable workflow caller job', () => {
    const yaml = `
name: Reusable
on: push
jobs:
  code-security:
    name: SAST Scan
    uses: org/repo/.github/workflows/sast.yml@v1
    with:
      REPOSITORY_NAME: \${{ github.repository }}
      COMMIT_SHA: \${{ github.sha }}
      TYPE: ts,nodejs
    secrets: inherit
`
    const { workflow, errors } = parseWorkflow(yaml)
    expect(errors).toEqual([])
    const job = workflow.jobs['code-security']
    expect(job.uses).toBe('org/repo/.github/workflows/sast.yml@v1')
    expect(job['runs-on']).toBeUndefined()
    expect(job.steps).toBeUndefined()
    expect((job.with as Record<string, unknown>)['TYPE']).toBe('ts,nodejs')
    expect(job.secrets).toBe('inherit')

    // Re-serialize and verify runs-on / steps are absent
    const out = serializeWorkflow(workflow)
    expect(out).toContain('uses: org/repo/.github/workflows/sast.yml@v1')
    expect(out).not.toContain('runs-on')
    expect(out).not.toContain('steps')
    expect(out).toContain('secrets: inherit')

    // Parse the serialized output and verify round-trip
    const { workflow: again, errors: errs2 } = parseWorkflow(out)
    expect(errs2).toEqual([])
    expect(again.jobs['code-security'].uses).toBe('org/repo/.github/workflows/sast.yml@v1')
    expect(again.jobs['code-security']['runs-on']).toBeUndefined()
  })

  it('serializes reusable job without a name', () => {
    const { workflow } = parseWorkflow(`
on: push
jobs:
  call:
    uses: org/repo/.github/workflows/ci.yml@main
`)
    const yaml = serializeWorkflow(workflow)
    expect(yaml).toContain('uses: org/repo/.github/workflows/ci.yml@main')
    // Reusable job has no name → the job block should not have a name key
    const { workflow: again } = parseWorkflow(yaml)
    expect(again.jobs.call.name).toBeUndefined()
  })

  it('serializes reusable job with needs, permissions, and if', () => {
    const { workflow } = parseWorkflow(`
name: Full Reusable
on: push
jobs:
  setup:
    runs-on: ubuntu-latest
    steps:
      - run: echo setup
  call:
    needs: setup
    if: "github.ref == 'refs/heads/main'"
    uses: org/repo/.github/workflows/deploy.yml@main
    permissions:
      contents: read
      deployments: write
    secrets: inherit
`)
    const yaml = serializeWorkflow(workflow)
    expect(yaml).toContain('needs: setup')
    expect(yaml).toContain("if: github.ref == 'refs/heads/main'")
    expect(yaml).toContain('uses: org/repo/.github/workflows/deploy.yml@main')
    expect(yaml).toContain('contents: read')
    expect(yaml).toContain('deployments: write')
    const { workflow: again, errors } = parseWorkflow(yaml)
    expect(errors).toEqual([])
    expect(again.jobs.call.needs).toBe('setup')
    expect(again.jobs.call.if).toBe("github.ref == 'refs/heads/main'")
    expect(again.jobs.call.permissions).toMatchObject({ contents: 'read', deployments: 'write' })
  })

  it('serializes reusable job with secrets as a map', () => {
    const { workflow } = parseWorkflow(`
name: Secrets Map
on: push
jobs:
  call:
    uses: org/repo/.github/workflows/ci.yml@main
    secrets:
      TOKEN: \${{ secrets.MY_TOKEN }}
`)
    const yaml = serializeWorkflow(workflow)
    expect(yaml).toContain('TOKEN')
    expect(yaml).toContain('secrets.MY_TOKEN')
    const { workflow: again } = parseWorkflow(yaml)
    expect(again.jobs.call.secrets).toMatchObject({ TOKEN: '${{ secrets.MY_TOKEN }}' })
  })
})

describe('isReusableCallerJob', () => {
  it('returns true for a job with a string uses field', () => {
    expect(isReusableCallerJob({ uses: 'org/repo/.github/workflows/ci.yml@main', 'runs-on': undefined })).toBe(true)
  })

  it('returns false for a normal job without uses', () => {
    expect(isReusableCallerJob({ 'runs-on': 'ubuntu-latest', steps: [] })).toBe(false)
  })

  it('returns false when uses is not a string', () => {
    expect(isReusableCallerJob({ uses: undefined, 'runs-on': 'ubuntu-latest' })).toBe(false)
  })
})
