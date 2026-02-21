import { vi, describe, it, expect } from 'vitest'

/**
 * These tests use vi.mock to inject controlled parser responses so we can
 * exercise branches that real YAML inputs cannot easily reach:
 *   - e.prefix being a non-empty string (maps to LintError.path)
 *   - the catch block when the parser throws unexpectedly
 */
vi.mock('@actions/workflow-parser', () => ({
  NoOperationTraceWriter: class {},
  parseWorkflow: vi.fn().mockReturnValue({
    context: {
      errors: {
        getErrors: () => [{ message: 'field error', prefix: 'jobs/build' }],
      },
    },
  }),
}))

import { validateWorkflowYaml } from './workflowValidation'
import { parseWorkflow as mockedParseWorkflow } from '@actions/workflow-parser'

describe('validateWorkflowYaml (mocked parser)', () => {
  it('maps a non-empty e.prefix to the path field', () => {
    const errors = validateWorkflowYaml('any yaml')
    expect(errors).toHaveLength(1)
    expect(errors[0].path).toBe('jobs/build')
    expect(errors[0].severity).toBe('error')
  })

  it('returns a validation error when the parser throws an Error', () => {
    vi.mocked(mockedParseWorkflow).mockImplementationOnce(() => {
      throw new Error('unexpected crash')
    })
    const errors = validateWorkflowYaml('any yaml')
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain('unexpected crash')
    expect(errors[0].severity).toBe('error')
    expect(errors[0].path).toBeUndefined()
  })

  it('returns a validation error when the parser throws a non-Error value', () => {
    vi.mocked(mockedParseWorkflow).mockImplementationOnce(() => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw 'raw string error'
    })
    const errors = validateWorkflowYaml('any yaml')
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain('raw string error')
    expect(errors[0].severity).toBe('error')
  })
})
