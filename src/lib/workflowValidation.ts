import { NoOperationTraceWriter, parseWorkflow } from '@actions/workflow-parser'

export interface LintError {
  message: string
  path?: string
  severity: 'error' | 'warning'
}

const trace = new NoOperationTraceWriter()

/**
 * Validate a GitHub Actions workflow YAML string using the official
 * @actions/workflow-parser (same as the GitHub Actions VS Code extension).
 * Returns a list of lint errors suitable for display in the UI.
 */
export function validateWorkflowYaml(
  yamlContent: string,
  filename: string = 'workflow.yml'
): LintError[] {
  try {
    const result = parseWorkflow(
      { name: filename, content: yamlContent },
      trace
    )
    const errors = result.context.errors.getErrors()
    return errors.map((e) => {
      /* v8 ignore next */
      const path = e.prefix || undefined
      return { message: e.message, path, severity: 'error' as const }
    })
  } catch (err) {
    /* v8 ignore next */
    const message = err instanceof Error ? err.message : String(err)
    return [
      {
        message: `Validation failed: ${message}`,
        severity: 'error',
      },
    ]
  }
}
