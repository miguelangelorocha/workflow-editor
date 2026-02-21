/**
 * Property-based fuzz tests for workflow parsing and serialization.
 * Uses fast-check to generate arbitrary inputs and verify invariants.
 */
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { parseWorkflow } from './parseWorkflow'
import { serializeWorkflow } from './serializeWorkflow'
import type { Workflow, WorkflowJob, WorkflowStep } from '@/types/workflow'

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const safeString = fc.string({ minLength: 0, maxLength: 64 })

const stepArbitrary: fc.Arbitrary<WorkflowStep> = fc.record(
  {
    id: fc.option(safeString, { nil: undefined }),
    name: fc.option(safeString, { nil: undefined }),
    uses: fc.option(safeString, { nil: undefined }),
    run: fc.option(safeString, { nil: undefined }),
    shell: fc.option(safeString, { nil: undefined }),
  },
  { requiredKeys: [] }
)

const jobArbitrary: fc.Arbitrary<WorkflowJob> = fc.record(
  {
    name: fc.option(safeString, { nil: undefined }),
    'runs-on': fc.oneof(
      fc.constantFrom('ubuntu-latest', 'windows-latest', 'macos-latest'),
      fc.array(fc.constantFrom('ubuntu-latest', 'self-hosted'), { minLength: 1, maxLength: 3 })
    ),
    needs: fc.option(
      fc.oneof(safeString, fc.array(safeString, { minLength: 1, maxLength: 3 })),
      { nil: undefined }
    ),
    steps: fc.array(stepArbitrary, { minLength: 0, maxLength: 5 }),
  },
  { requiredKeys: ['runs-on', 'steps'] }
) as fc.Arbitrary<WorkflowJob>

const jobIdArbitrary = fc.stringMatching(/^[a-zA-Z_][a-zA-Z0-9_-]{0,15}$/)

const workflowArbitrary: fc.Arbitrary<Workflow> = fc
  .array(fc.tuple(jobIdArbitrary, jobArbitrary), { minLength: 1, maxLength: 4 })
  .map((pairs) => {
    const jobs: Record<string, WorkflowJob> = {}
    for (const [id, job] of pairs) {
      jobs[id] = job
    }
    return {
      name: 'Generated',
      on: { push: {} },
      jobs,
    } satisfies Workflow
  })

// ---------------------------------------------------------------------------
// Invariant: parseWorkflow never throws
// ---------------------------------------------------------------------------

describe('parseWorkflow – safety invariant', () => {
  it('never throws on arbitrary string input', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        expect(() => parseWorkflow(input)).not.toThrow()
      }),
      { numRuns: 500 }
    )
  })

  it('always returns a result with workflow and errors arrays', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const result = parseWorkflow(input)
        expect(result).toHaveProperty('workflow')
        expect(result).toHaveProperty('errors')
        expect(Array.isArray(result.errors)).toBe(true)
        expect(typeof result.workflow).toBe('object')
        expect(result.workflow).not.toBeNull()
      }),
      { numRuns: 500 }
    )
  })

  it('always returns a workflow with a jobs object', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const { workflow } = parseWorkflow(input)
        expect(typeof workflow.jobs).toBe('object')
        expect(workflow.jobs).not.toBeNull()
      }),
      { numRuns: 500 }
    )
  })

  it('never returns both empty errors and missing jobs', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const { workflow, errors } = parseWorkflow(input)
        if (errors.length === 0 && input.trim() !== '') {
          // If no errors were reported, jobs must be an object
          expect(typeof workflow.jobs).toBe('object')
        }
      }),
      { numRuns: 500 }
    )
  })
})

// ---------------------------------------------------------------------------
// Invariant: serializeWorkflow never throws on valid workflow objects
// ---------------------------------------------------------------------------

describe('serializeWorkflow – safety invariant', () => {
  it('never throws on arbitrary valid workflow objects', () => {
    fc.assert(
      fc.property(workflowArbitrary, (workflow) => {
        expect(() => serializeWorkflow(workflow)).not.toThrow()
      }),
      { numRuns: 200 }
    )
  })

  it('always returns a non-empty string', () => {
    fc.assert(
      fc.property(workflowArbitrary, (workflow) => {
        const result = serializeWorkflow(workflow)
        expect(typeof result).toBe('string')
        expect(result.length).toBeGreaterThan(0)
      }),
      { numRuns: 200 }
    )
  })
})

// ---------------------------------------------------------------------------
// Invariant: round-trip stability (serialize → parse → serialize is stable)
// ---------------------------------------------------------------------------

describe('round-trip stability', () => {
  it('parse → serialize → parse produces consistent errors count', () => {
    fc.assert(
      fc.property(workflowArbitrary, (workflow) => {
        const yaml1 = serializeWorkflow(workflow)
        const { errors: errors1 } = parseWorkflow(yaml1)

        const yaml2 = serializeWorkflow(parseWorkflow(yaml1).workflow)
        const { errors: errors2 } = parseWorkflow(yaml2)

        // A well-formed workflow should have the same error count after a round-trip
        expect(errors1.length).toBe(errors2.length)
      }),
      { numRuns: 200 }
    )
  })

  it('job names survive a round-trip through serialize/parse', () => {
    fc.assert(
      fc.property(workflowArbitrary, (workflow) => {
        const yaml = serializeWorkflow(workflow)
        const { workflow: parsed } = parseWorkflow(yaml)

        const originalIds = Object.keys(workflow.jobs).sort()
        const parsedIds = Object.keys(parsed.jobs).sort()
        expect(parsedIds).toEqual(originalIds)
      }),
      { numRuns: 200 }
    )
  })

  it('step counts survive a round-trip through serialize/parse', () => {
    fc.assert(
      fc.property(workflowArbitrary, (workflow) => {
        const yaml = serializeWorkflow(workflow)
        const { workflow: parsed } = parseWorkflow(yaml)

        for (const jobId of Object.keys(workflow.jobs)) {
          const originalCount = workflow.jobs[jobId].steps.length
          const parsedCount = parsed.jobs[jobId]?.steps.length ?? -1
          expect(parsedCount).toBe(originalCount)
        }
      }),
      { numRuns: 200 }
    )
  })
})

// ---------------------------------------------------------------------------
// Invariant: parse handles malformed YAML safely
// ---------------------------------------------------------------------------

describe('parseWorkflow – malformed YAML safety', () => {
  const malformedInputs = [
    '{{{',
    '---\n  - :\n',
    '\x00\x01\x02',
    '  key: [unclosed',
    '% tag: !invalid',
    'a: b: c: d',
    '\n'.repeat(1000),
    'x: '.repeat(500),
  ]

  it.each(malformedInputs)('does not throw on %j', (input) => {
    expect(() => parseWorkflow(input)).not.toThrow()
    const result = parseWorkflow(input)
    expect(result).toHaveProperty('workflow')
    expect(result).toHaveProperty('errors')
  })
})
