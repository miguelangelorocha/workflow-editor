import YAML from 'yaml'
import type { Workflow } from '@/types/workflow'

const STRINGIFY_OPTS = {
  indent: 2,
  lineWidth: 0,
  collectionStyle: 'block' as const,
  defaultStringType: 'PLAIN' as const,
}

/**
 * Serialize workflow model to YAML string.
 * Produces valid GitHub Actions workflow YAML.
 */
export function serializeWorkflow(workflow: Workflow): string {
  const obj = workflowToPlainObject(workflow)
  return YAML.stringify(obj, STRINGIFY_OPTS)
}

/**
 * Merge workflow changes into original YAML so that comments and formatting
 * are preserved where possible. Use when we have file content (originalYaml)
 * and the user has edited the workflow in the graph (e.g. added a job).
 * Falls back to serializeWorkflow if parsing fails or document is invalid.
 */
export function mergeWorkflowIntoYaml(originalYaml: string, workflow: Workflow): string {
  try {
    const doc = YAML.parseDocument(originalYaml, { strict: false })
    if (doc.errors.length > 0) return serializeWorkflow(workflow)

    const contents = doc.contents as { get?: (k: unknown) => unknown; set?: (k: unknown, v: unknown) => void; items?: unknown[] } | null
    if (!contents || typeof contents.get !== 'function') return serializeWorkflow(workflow)

    const jobsMap = doc.get('jobs', true) as { set?: (k: unknown, v: unknown) => void; delete?: (k: unknown) => boolean; items?: { key: { value?: string } }[] } | undefined
    if (!jobsMap || typeof jobsMap.set !== 'function') {
      doc.set('name', doc.createNode(workflow.name))
      doc.set('run-name', doc.createNode(workflow['run-name']))
      doc.set('on', doc.createNode(workflow.on))
      if (workflow.env && Object.keys(workflow.env).length > 0) doc.set('env', doc.createNode(workflow.env))
      doc.set('jobs', doc.createNode(jobsToPlainObject(workflow.jobs)))
      return doc.toString(STRINGIFY_OPTS)
    }

    doc.set('name', doc.createNode(workflow.name))
    doc.set('run-name', doc.createNode(workflow['run-name']))
    doc.set('on', doc.createNode(workflow.on))
    if (workflow.env && Object.keys(workflow.env).length > 0) doc.set('env', doc.createNode(workflow.env))

    for (const [jobId, job] of Object.entries(workflow.jobs)) {
      jobsMap.set(jobId, doc.createNode(jobToPlainObjectSingle(job)))
    }
    const items = jobsMap.items ?? []
    const keysToDelete: unknown[] = []
    for (const pair of items) {
      const p = pair as { key: { value?: string } | string }
      const keyVal = p.key && typeof p.key === 'object' && 'value' in p.key ? p.key.value : p.key
      if (keyVal != null && !(String(keyVal) in workflow.jobs)) keysToDelete.push(p.key)
    }
    for (const k of keysToDelete) {
      if (typeof jobsMap.delete === 'function') jobsMap.delete(k)
    }

    return doc.toString(STRINGIFY_OPTS)
  } catch {
    return serializeWorkflow(workflow)
  }
}

function workflowToPlainObject(workflow: Workflow): Record<string, unknown> {
  const obj: Record<string, unknown> = {}
  if (workflow.name !== undefined) obj.name = workflow.name
  if (workflow['run-name'] !== undefined) obj['run-name'] = workflow['run-name']
  obj.on = workflow.on
  if (workflow.env && Object.keys(workflow.env).length > 0) obj.env = workflow.env
  obj.jobs = jobsToPlainObject(workflow.jobs)
  return obj
}

function jobsToPlainObject(jobs: Workflow['jobs']): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [jobId, job] of Object.entries(jobs)) {
    out[jobId] = jobToPlainObjectSingle(job)
  }
  return out
}

function jobToPlainObjectSingle(job: import('@/types/workflow').WorkflowJob): Record<string, unknown> {
  const { steps, strategy, ...rest } = job
  const j: Record<string, unknown> = {
    ...rest,
    'runs-on': job['runs-on'],
    steps: steps.map((s) => stepToSerializable(s)),
  }
  if (strategy) {
    const strategyObj: Record<string, unknown> = {}
    if (strategy.matrix && Object.keys(strategy.matrix).length > 0) strategyObj.matrix = strategy.matrix
    if (strategy['fail-fast'] !== undefined) strategyObj['fail-fast'] = strategy['fail-fast']
    if (strategy['max-parallel'] !== undefined) strategyObj['max-parallel'] = strategy['max-parallel']
    if (Object.keys(strategyObj).length > 0) j.strategy = strategyObj
  }
  return j
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
