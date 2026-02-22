import YAML from 'yaml'
import type { Workflow } from '@/types/workflow'

export interface ParseResult {
  workflow: Workflow
  errors: string[]
}

/**
 * Parse YAML string into a workflow model.
 * Returns workflow and any validation errors (e.g. missing jobs).
 */
export function parseWorkflow(yamlContent: string): ParseResult {
  const errors: string[] = []

  // Treat completely empty files as an empty workflow with no errors.
  // This allows the UI to show the onboarding state and create the
  // initial structure without surfacing validation errors.
  if (yamlContent.trim() === '') {
    return {
      workflow: { name: '', on: {}, jobs: {} },
      errors: [],
    }
  }

  let parsed: unknown
  try {
    parsed = YAML.parse(yamlContent, { strict: false })
  } catch (e) {
    /* v8 ignore next */
    const message = e instanceof Error ? e.message : String(e)
    return {
      workflow: { name: '', on: {}, jobs: {} },
      errors: [`YAML parse error: ${message}`],
    }
  }

  if (parsed == null || typeof parsed !== 'object') {
    return {
      workflow: { name: '', on: {}, jobs: {} },
      errors: ['Invalid workflow: root must be an object'],
    }
  }

  const obj = parsed as Record<string, unknown>

  if (!('jobs' in obj) || obj.jobs == null || typeof obj.jobs !== 'object') {
    errors.push('Workflow must have a "jobs" object')
  }

  const jobs = (obj.jobs as Record<string, unknown>) ?? {}
  const workflow: Workflow = {
    ...obj,
    name: typeof obj.name === 'string' ? obj.name : undefined,
    'run-name': typeof obj['run-name'] === 'string' ? obj['run-name'] : undefined,
    on: (obj.on ?? {}) as Workflow['on'],
    env: typeof obj.env === 'object' && obj.env !== null && !Array.isArray(obj.env)
      ? (obj.env as Record<string, string>)
      : undefined,
    jobs: {},
  }

  for (const [jobId, jobVal] of Object.entries(jobs)) {
    if (jobVal == null || typeof jobVal !== 'object' || Array.isArray(jobVal)) {
      errors.push(`Job "${jobId}" must be an object`)
      continue
    }
    const j = jobVal as Record<string, unknown>
    const steps = Array.isArray(j.steps) ? j.steps : []
    let strategy: import('@/types/workflow').WorkflowJobStrategy | undefined
    if (j.strategy && typeof j.strategy === 'object' && j.strategy !== null && !Array.isArray(j.strategy)) {
      const strat = j.strategy as Record<string, unknown>
      const matrix =
        typeof strat.matrix === 'object' && strat.matrix !== null && !Array.isArray(strat.matrix)
          ? (strat.matrix as Record<string, string[] | number[]>)
          : undefined
      const failFast = typeof strat['fail-fast'] === 'boolean' ? strat['fail-fast'] : undefined
      const maxParallel = typeof strat['max-parallel'] === 'number' ? strat['max-parallel'] : undefined
      if (matrix || failFast !== undefined || maxParallel !== undefined) {
        strategy = {
          matrix,
          'fail-fast': failFast,
          'max-parallel': maxParallel,
        }
      }
    }
    const name = typeof j.name === 'string' ? j.name : undefined
    const needs = j.needs as string | string[] | undefined
    const permissions = typeof j.permissions === 'object' && j.permissions !== null && !Array.isArray(j.permissions)
      ? (j.permissions as Record<string, string>)
      : undefined
    const jobIf = typeof j.if === 'string' ? j.if : undefined

    if (typeof j.uses === 'string') {
      // Reusable workflow caller job: must not have runs-on or steps
      const withInputs = typeof j.with === 'object' && j.with !== null && !Array.isArray(j.with)
        ? (j.with as Record<string, unknown>)
        : undefined
      const secrets = j.secrets === 'inherit'
        ? ('inherit' as const)
        : typeof j.secrets === 'object' && j.secrets !== null && !Array.isArray(j.secrets)
          ? (j.secrets as Record<string, string>)
          : undefined
      workflow.jobs[jobId] = {
        ...j,
        name,
        uses: j.uses,
        with: withInputs,
        secrets,
        needs,
        permissions,
        if: jobIf,
        // Explicitly exclude runs-on and steps so they are not present
        'runs-on': undefined,
        steps: undefined,
      }
    } else {
      // Normal job with runs-on and steps
      const env = typeof j.env === 'object' && j.env !== null && !Array.isArray(j.env)
        ? (j.env as Record<string, string>)
        : undefined
      workflow.jobs[jobId] = {
        ...j,
        name,
        'runs-on': (typeof j['runs-on'] === 'string' || Array.isArray(j['runs-on'])
          ? j['runs-on']
          : 'ubuntu-latest') as string | string[],
        needs,
        permissions,
        env,
        strategy,
        steps: steps.map((s, i) => normalizeStep(s, jobId, i)),
      }
    }
  }

  return { workflow, errors }
}

function normalizeStep(
  s: unknown,
  _jobId: string,
  index: number
): import('@/types/workflow').WorkflowStep {
  if (s == null || typeof s !== 'object' || Array.isArray(s)) {
    return { name: `Step ${index + 1}`, run: '' }
  }
  const step = s as Record<string, unknown>
  return {
    id: typeof step.id === 'string' ? step.id : undefined,
    name: typeof step.name === 'string' ? step.name : undefined,
    uses: typeof step.uses === 'string' ? step.uses : undefined,
    run: typeof step.run === 'string' ? step.run : undefined,
    with:
      typeof step.with === 'object' && step.with !== null && !Array.isArray(step.with)
        ? (step.with as Record<string, unknown>)
        : undefined,
    env:
      typeof step.env === 'object' && step.env !== null && !Array.isArray(step.env)
        ? (step.env as Record<string, string>)
        : undefined,
    shell: typeof step.shell === 'string' ? step.shell : undefined,
    ...step,
  }
}
