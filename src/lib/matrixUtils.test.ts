import { describe, it, expect } from 'vitest'
import { mergeMatrixEntry, type MatrixRecord } from './matrixUtils'

describe('mergeMatrixEntry', () => {
  it('returns unchanged matrix when incoming values are empty after trim', () => {
    const matrix: MatrixRecord = { node: ['20', '22'] }
    const result = mergeMatrixEntry(matrix, 'node', [])
    expect(result).toEqual({ node: ['20', '22'] })
    expect(result).not.toBe(matrix)
  })

  it('returns unchanged matrix when incoming values are only whitespace', () => {
    const matrix: MatrixRecord = { node: ['20'] }
    const result = mergeMatrixEntry(matrix, 'node', ['  ', '', '   '])
    expect(result).toEqual({ node: ['20'] })
  })

  it('creates new string entry when key does not exist', () => {
    const matrix: MatrixRecord = {}
    const result = mergeMatrixEntry(matrix, 'node', ['20', '22'])
    expect(result).toEqual({ node: ['20', '22'] })
  })

  it('creates new string entry when existing value is not an array', () => {
    const matrix = { node: 'invalid' } as unknown as MatrixRecord
    const result = mergeMatrixEntry(matrix, 'node', ['20'])
    expect(result).toEqual({ node: ['20'] })
  })

  it('merges into existing string array and dedupes by string equality', () => {
    const matrix: MatrixRecord = { node: ['20', '22'] }
    const result = mergeMatrixEntry(matrix, 'node', ['22', '24'])
    expect(result).toEqual({ node: ['20', '22', '24'] })
  })

  it('does not add duplicate when value already exists as string', () => {
    const matrix: MatrixRecord = { node: ['20'] }
    const result = mergeMatrixEntry(matrix, 'node', ['20'])
    expect(result).toEqual({ node: ['20'] })
  })

  it('merges into existing number array and coerces incoming values', () => {
    const matrix: MatrixRecord = { node: [20, 22] }
    const result = mergeMatrixEntry(matrix, 'node', ['24', '25'])
    expect(result).toEqual({ node: [20, 22, 24, 25] })
  })

  it('filters out NaN when merging into number array', () => {
    const matrix: MatrixRecord = { node: [20, 22] }
    const result = mergeMatrixEntry(matrix, 'node', ['abc', '24', 'x'])
    expect(result).toEqual({ node: [20, 22, 24] })
  })

  it('dedupes when merging into number array (string "20" matches existing 20)', () => {
    const matrix: MatrixRecord = { node: [20, 22] }
    const result = mergeMatrixEntry(matrix, 'node', ['20', '24'])
    expect(result).toEqual({ node: [20, 22, 24] })
  })

  it('trims whitespace from incoming values', () => {
    const matrix: MatrixRecord = {}
    const result = mergeMatrixEntry(matrix, 'node', ['  20  ', ' 22 ', '24'])
    expect(result).toEqual({ node: ['20', '22', '24'] })
  })

  it('does not mutate the input matrix', () => {
    const matrix: MatrixRecord = { node: ['20'] }
    const result = mergeMatrixEntry(matrix, 'node', ['22'])
    expect(matrix).toEqual({ node: ['20'] })
    expect(result).toEqual({ node: ['20', '22'] })
  })

  it('preserves other matrix keys when merging', () => {
    const matrix: MatrixRecord = { node: ['20'], os: ['ubuntu-latest'] }
    const result = mergeMatrixEntry(matrix, 'node', ['22'])
    expect(result).toEqual({ node: ['20', '22'], os: ['ubuntu-latest'] })
  })

  it('handles empty existing array by adding as strings', () => {
    const matrix: MatrixRecord = { node: [] }
    const result = mergeMatrixEntry(matrix, 'node', ['20', '22'])
    expect(result).toEqual({ node: ['20', '22'] })
  })

  it('dedupes within incoming batch before adding to new key', () => {
    const matrix: MatrixRecord = {}
    const result = mergeMatrixEntry(matrix, 'node', ['20', '22', '20', '24'])
    expect(result).toEqual({ node: ['20', '22', '24'] })
  })

  it('dedupes within incoming batch before adding to existing array', () => {
    const matrix: MatrixRecord = { node: ['20'] }
    const result = mergeMatrixEntry(matrix, 'node', ['22', '24', '22'])
    expect(result).toEqual({ node: ['20', '22', '24'] })
  })

  it('preserves version string semantics (3.10 is not 3.1)', () => {
    const matrix: MatrixRecord = { python: ['3.1', '3.9'] }
    const result = mergeMatrixEntry(matrix, 'python', ['3.10', '3.11'])
    expect(result).toEqual({ python: ['3.1', '3.9', '3.10', '3.11'] })
  })
})
