import { describe, it, expect } from 'vitest'
import { workflowToFlowNodesEdges } from './workflowToFlow'
import { parseWorkflow } from './parseWorkflow'

const minimalYaml = `
name: Minimal
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo hello
`

const withNeedsYaml = `
name: With Needs
on: push
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

const withMatrixYaml = `
name: Matrix
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: [18, 20]
        os: [ubuntu-latest, macos-latest]
    steps:
      - run: echo build
`

describe('workflowToFlowNodesEdges', () => {
  it('produces trigger node and job node for minimal workflow', () => {
    const { workflow } = parseWorkflow(minimalYaml)
    const { nodes, edges } = workflowToFlowNodesEdges(workflow)
    const triggerNodes = nodes.filter((n) => n.id.startsWith('__trigger__'))
    const jobNodes = nodes.filter((n) => n.type === 'job')
    expect(triggerNodes.length).toBe(1)
    expect(jobNodes.length).toBe(1)
    expect(jobNodes[0].data).toMatchObject({
      jobId: 'build',
      stepCount: 1,
    })
    expect(edges.some((e) => e.source === '__trigger__0' && e.target === 'build')).toBe(true)
  })

  it('produces add-job node connected to last column', () => {
    const { workflow } = parseWorkflow(minimalYaml)
    const { nodes, edges } = workflowToFlowNodesEdges(workflow)
    const addJobNode = nodes.find((n) => n.id === '__add_job__')
    expect(addJobNode).toBeDefined()
    expect(edges.some((e) => e.source === 'build' && e.target === '__add_job__')).toBe(true)
  })

  it('creates edges for needs', () => {
    const { workflow } = parseWorkflow(withNeedsYaml)
    const { nodes, edges } = workflowToFlowNodesEdges(workflow)
    expect(edges.some((e) => e.source === 'one' && e.target === 'two')).toBe(true)
    const jobIds = nodes.filter((n) => n.type === 'job').map((n) => n.id)
    expect(jobIds).toContain('one')
    expect(jobIds).toContain('two')
  })

  it('assigns matrixCombinations when strategy.matrix is present', () => {
    const { workflow } = parseWorkflow(withMatrixYaml)
    const { nodes } = workflowToFlowNodesEdges(workflow)
    const jobNode = nodes.find((n) => n.type === 'job' && n.data && 'matrixCombinations' in n.data)
    expect(jobNode).toBeDefined()
    expect((jobNode!.data as { matrixCombinations?: number }).matrixCombinations).toBe(4) // 2 * 2
  })

  it('handles workflow with no jobs', () => {
    const workflow = {
      name: 'Empty',
      on: 'push',
      jobs: {},
    }
    const { nodes, edges } = workflowToFlowNodesEdges(workflow)
    expect(nodes.filter((n) => n.type === 'job')).toHaveLength(0)
    expect(nodes.some((n) => n.id.startsWith('__trigger__'))).toBe(true)
    expect(edges).toHaveLength(0)
  })

  it('handles workflow with multiple triggers', () => {
    const yaml = `
name: Multi
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo hi
`
    const { workflow } = parseWorkflow(yaml)
    const { nodes } = workflowToFlowNodesEdges(workflow)
    const triggerNodes = nodes.filter((n) => n.id.startsWith('__trigger__'))
    expect(triggerNodes.length).toBe(2)
  })

  it('creates a single empty trigger node when workflow has no triggers', () => {
    // on: {} produces zero parsed triggers — should still render one placeholder trigger node
    const workflow = { on: {}, jobs: { build: { 'runs-on': 'ubuntu-latest', steps: [{ run: 'echo hi' }] } } }
    const { nodes } = workflowToFlowNodesEdges(workflow as Parameters<typeof workflowToFlowNodesEdges>[0])
    const triggerNodes = nodes.filter((n) => n.id.startsWith('__trigger__'))
    expect(triggerNodes.length).toBe(1)
    expect((triggerNodes[0].data as { triggers: unknown[] }).triggers).toEqual([])
  })

  it('handles job with array needs', () => {
    const yaml = `
name: Array Needs
on: push
jobs:
  one:
    runs-on: ubuntu-latest
    steps:
      - run: echo one
  two:
    runs-on: ubuntu-latest
    steps:
      - run: echo two
  three:
    needs: [one, two]
    runs-on: ubuntu-latest
    steps:
      - run: echo three
`
    const { workflow } = parseWorkflow(yaml)
    const { edges } = workflowToFlowNodesEdges(workflow)
    expect(edges.some((e) => e.source === 'one' && e.target === 'three')).toBe(true)
    expect(edges.some((e) => e.source === 'two' && e.target === 'three')).toBe(true)
  })

  it('handles job with runs-on as array (label-based runners)', () => {
    const yaml = `
name: Array Runner
on: push
jobs:
  build:
    runs-on: [ubuntu-latest, self-hosted]
    steps:
      - run: echo hi
`
    const { workflow } = parseWorkflow(yaml)
    const { nodes } = workflowToFlowNodesEdges(workflow)
    const jobNode = nodes.find((n) => n.type === 'job')
    expect(jobNode).toBeDefined()
    expect((jobNode!.data as { runsOn: string }).runsOn).toBe('ubuntu-latest, self-hosted')
  })

  it('handles circular job dependency without infinite loop', () => {
    // Circular deps are invalid in GitHub Actions but the layout algorithm
    // must not hang; it breaks the cycle by placing remaining[0]
    const workflow = {
      on: 'push',
      jobs: {
        a: { 'runs-on': 'ubuntu-latest', needs: 'b', steps: [{ run: 'echo a' }] },
        b: { 'runs-on': 'ubuntu-latest', needs: 'a', steps: [{ run: 'echo b' }] },
      },
    }
    const { nodes } = workflowToFlowNodesEdges(workflow as Parameters<typeof workflowToFlowNodesEdges>[0])
    const jobIds = nodes.filter((n) => n.type === 'job').map((n) => n.id)
    expect(jobIds).toContain('a')
    expect(jobIds).toContain('b')
  })
})
