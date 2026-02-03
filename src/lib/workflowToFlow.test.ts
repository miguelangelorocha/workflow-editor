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
})
