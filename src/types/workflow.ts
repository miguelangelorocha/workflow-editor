/**
 * TypeScript types for GitHub Actions workflow model.
 * Aligned with https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions
 */

export interface WorkflowStep {
  id?: string
  name?: string
  uses?: string
  run?: string
  with?: Record<string, unknown>
  env?: Record<string, string>
  shell?: string
  [key: string]: unknown
}

export interface WorkflowJobStrategy {
  matrix?: Record<string, string[] | number[]>
  'fail-fast'?: boolean
  'max-parallel'?: number
}

export interface WorkflowJob {
  name?: string
  /** Present on normal jobs; absent on reusable workflow caller jobs. */
  'runs-on'?: string | string[]
  /**
   * Present on reusable workflow caller jobs (job-level `uses`).
   * When set, `runs-on` and `steps` must be absent.
   */
  uses?: string
  /** Inputs passed to a reusable workflow caller job. */
  with?: Record<string, unknown>
  /** Secrets passed to a reusable workflow caller job. */
  secrets?: Record<string, string> | 'inherit'
  needs?: string | string[]
  permissions?: Record<string, string>
  env?: Record<string, string>
  /** Present on normal jobs; absent on reusable workflow caller jobs. */
  steps?: WorkflowStep[]
  strategy?: WorkflowJobStrategy
  container?: unknown
  services?: Record<string, unknown>
  if?: string
  [key: string]: unknown
}

/** Returns true when the job calls a reusable workflow via job-level `uses`. */
export function isReusableCallerJob(job: WorkflowJob): boolean {
  return typeof job.uses === 'string'
}

export interface Workflow {
  name?: string
  'run-name'?: string
  on: Record<string, unknown> | string | (string | Record<string, unknown>)[]
  env?: Record<string, string>
  jobs: Record<string, WorkflowJob>
  [key: string]: unknown
}
