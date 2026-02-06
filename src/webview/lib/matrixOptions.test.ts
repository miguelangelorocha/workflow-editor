import { describe, it, expect } from 'vitest'
import {
  COMMON_MATRIX_VARIABLES,
  getMatrixVariableValues,
  isCommonMatrixVariable,
} from './matrixOptions'

describe('COMMON_MATRIX_VARIABLES', () => {
  it('includes node, os, python', () => {
    const names = COMMON_MATRIX_VARIABLES.map((v) => v.name)
    expect(names).toContain('node')
    expect(names).toContain('os')
    expect(names).toContain('python')
  })

  it('each variable has name, label, and values array', () => {
    for (const opt of COMMON_MATRIX_VARIABLES) {
      expect(opt.name).toBeDefined()
      expect(opt.label).toBeDefined()
      expect(Array.isArray(opt.values)).toBe(true)
      expect(opt.values.length).toBeGreaterThan(0)
    }
  })
})

describe('getMatrixVariableValues', () => {
  it('returns values for known variable name', () => {
    expect(getMatrixVariableValues('node')).toEqual(['16', '18', '20', '22'])
    expect(getMatrixVariableValues('os')).toContain('ubuntu-latest')
    expect(getMatrixVariableValues('python')).toContain('3.12')
  })

  it('returns null for unknown variable name', () => {
    expect(getMatrixVariableValues('unknown')).toBeNull()
    expect(getMatrixVariableValues('')).toBeNull()
  })
})

describe('isCommonMatrixVariable', () => {
  it('returns true for common variables', () => {
    expect(isCommonMatrixVariable('node')).toBe(true)
    expect(isCommonMatrixVariable('os')).toBe(true)
    expect(isCommonMatrixVariable('python')).toBe(true)
    expect(isCommonMatrixVariable('java')).toBe(true)
  })

  it('returns false for unknown variables', () => {
    expect(isCommonMatrixVariable('custom_var')).toBe(false)
    expect(isCommonMatrixVariable('')).toBe(false)
  })
})
