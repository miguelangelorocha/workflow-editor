import YAML from 'yaml'
import type { Workflow } from '@/types/workflow'

/**
 * Serialize workflow model to YAML string.
 * Produces valid GitHub Actions workflow YAML.
 */
export function serializeWorkflow(workflow: Workflow): string {
  const obj: Record<string, unknown> = {
    ...workflow,
  }

  if (workflow.name !== undefined) obj.name = workflow.name
  if (workflow['run-name'] !== undefined) obj['run-name'] = workflow['run-name']
  obj.on = workflow.on
  if (workflow.env && Object.keys(workflow.env).length > 0) obj.env = workflow.env

  const jobs: Record<string, unknown> = {}
  for (const [jobId, job] of Object.entries(workflow.jobs)) {
    if (typeof job.uses === 'string') {
      // Reusable workflow caller job: only emit keys allowed by GitHub Actions schema
      const j: Record<string, unknown> = {}
      if (job.name !== undefined) j.name = job.name
      if (job.needs !== undefined) j.needs = job.needs
      if (job.permissions !== undefined) j.permissions = job.permissions
      if (job.if !== undefined) j.if = job.if
      j.uses = job.uses
      if (job.with && Object.keys(job.with).length > 0) j.with = job.with
      if (job.secrets !== undefined) j.secrets = job.secrets
      jobs[jobId] = j
    } else {
      // Normal job with runs-on and steps
      const { steps, strategy, ...rest } = job
      const j: Record<string, unknown> = {
        ...rest,
        'runs-on': job['runs-on'],
        steps: (steps ?? []).map((s) => stepToSerializable(s)),
      }
      if (strategy) {
        const strategyObj: Record<string, unknown> = {}
        if (strategy.matrix && Object.keys(strategy.matrix).length > 0) {
          strategyObj.matrix = strategy.matrix
        }
        if (strategy['fail-fast'] !== undefined) {
          strategyObj['fail-fast'] = strategy['fail-fast']
        }
        if (strategy['max-parallel'] !== undefined) {
          strategyObj['max-parallel'] = strategy['max-parallel']
        }
        /* v8 ignore next */
        if (Object.keys(strategyObj).length > 0) {
          j.strategy = strategyObj
        }
      }
      jobs[jobId] = j
    }
  }
  obj.jobs = jobs

  return YAML.stringify(obj, {
    indent: 2,
    lineWidth: 0,
    collectionStyle: 'block',
    defaultStringType: 'PLAIN',
    blockQuote: 'folded',
  })
}

function stepToSerializable(step: import('@/types/workflow').WorkflowStep): Record<string, unknown> {
  const { id, name, uses, run, with: withObj, env, shell, ...rest } = step
  const out: Record<string, unknown> = { ...rest }
  if (id !== undefined) out.id = id
  if (name !== undefined) out.name = name
  if (uses !== undefined) out.uses = uses
  if (run !== undefined) out.run = run
  if (withObj && Object.keys(withObj).length > 0) out.with = withObj
  if (env && Object.keys(env).length > 0) out.env = env
  if (shell !== undefined) out.shell = shell
  return out
}
