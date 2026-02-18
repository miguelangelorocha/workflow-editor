import type { Workflow } from '@/types/workflow'

export interface TriggerConfig {
  type?: string
  branches?: string[]
  tags?: string[]
  paths?: string[]
  pathsIgnore?: string[]
  types?: string[] // For pull_request, workflow_run, etc.
  inputs?: Record<string, { description?: string; required?: boolean; default?: string; type?: string }>
  cron?: string // For schedule triggers
  [key: string]: unknown
}

export interface ParsedTrigger {
  event: string
  config: TriggerConfig
}

/**
 * Triggers that support the optional `types` field
 * Reference: https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows
 */
export const TRIGGERS_WITH_TYPES = new Set([
  'branch_protection_rule',
  'check_run',
  'check_suite',
  'discussion',
  'discussion_comment',
  'issue_comment',
  'issues',
  'label',
  'merge_group',
  'milestone',
  'pull_request',
  'pull_request_review',
  'pull_request_review_comment',
  'pull_request_target',
  'registry_package',
  'release',
  'repository_dispatch',
  'watch',
  'workflow_run',
])

/**
 * Check if a trigger event supports the `types` field
 */
export function triggerSupportsTypes(event: string): boolean {
  return TRIGGERS_WITH_TYPES.has(event)
}

/**
 * Parse the workflow `on` field into an array of trigger configurations
 */
export function parseTriggers(on: Workflow['on'] | undefined): ParsedTrigger[] {
  if (!on) return []

  // Simple string: "push"
  if (typeof on === 'string') {
    return [{ event: on, config: {} }]
  }

  // Array: ["push", "pull_request"] or ["push", { pull_request: {...} }]
  if (Array.isArray(on)) {
    return on.flatMap((item) => {
      if (typeof item === 'string') {
        return [{ event: item, config: {} }]
      }
      if (typeof item === 'object' && item !== null) {
        return Object.entries(item).map(([event, config]) => ({
          event,
          config: (config as TriggerConfig) ?? {},
        }))
      }
      return []
    })
  }

  // Object: { push: { branches: ['main'] }, pull_request: {...}, schedule: [{ cron: '0 0 * * *' }] }
  if (typeof on === 'object' && on !== null) {
    const result: ParsedTrigger[] = []
    for (const [event, config] of Object.entries(on)) {
      // Schedule triggers use an array of cron objects
      if (event === 'schedule' && Array.isArray(config)) {
        for (const item of config) {
          if (typeof item === 'object' && item !== null && 'cron' in item) {
            result.push({
              event,
              config: { cron: (item as { cron: string }).cron },
            })
          } else {
            result.push({ event, config: {} })
          }
        }
      } else {
        result.push({
          event,
          config: (config as TriggerConfig) ?? {},
        })
      }
    }
    return result
  }

  return []
}

/**
 * Format trigger for display
 */
export function formatTrigger(trigger: ParsedTrigger): string {
  const { event, config } = trigger
  const parts: string[] = [event]

  if (config.branches && config.branches.length > 0) {
    parts.push(`branches: ${config.branches.join(', ')}`)
  }
  if (config.tags && config.tags.length > 0) {
    parts.push(`tags: ${config.tags.join(', ')}`)
  }
  if (config.paths && config.paths.length > 0) {
    parts.push(`paths: ${config.paths.join(', ')}`)
  }
  if (config.types && config.types.length > 0) {
    parts.push(`types: ${config.types.join(', ')}`)
  }

  return parts.join(' • ')
}

/**
 * Get a short display label for a trigger
 */
export function getTriggerLabel(trigger: ParsedTrigger): string {
  const { event, config } = trigger
  if (config.branches && config.branches.length > 0) {
    return `${event} (${config.branches.join(', ')})`
  }
  if (config.tags && config.tags.length > 0) {
    return `${event} (${config.tags.join(', ')})`
  }
  return event
}

/**
 * Convert parsed triggers back to workflow `on` format.
 * Always uses the object form so that trigger configs (inputs, branches, etc.)
 * are preserved correctly regardless of how many triggers are present.
 */
export function triggersToOn(triggers: ParsedTrigger[]): Workflow['on'] {
  if (triggers.length === 0) {
    return {}
  }

  const result: Record<string, unknown> = {}

  for (const trigger of triggers) {
    if (trigger.event === 'schedule') {
      // Schedule triggers require an array of { cron } objects
      const existing = result.schedule as { cron: string }[] | undefined
      const entry = { cron: trigger.config.cron || '0 0 * * *' }
      result.schedule = existing ? [...existing, entry] : [entry]
    } else {
      result[trigger.event] =
        Object.keys(trigger.config).length === 0 ? null : trigger.config
    }
  }

  const keys = Object.keys(result)

  // Single event with no config → compact string form: `on: push`
  if (keys.length === 1 && !('schedule' in result) && result[keys[0]] === null) {
    return keys[0]
  }

  return result
}
