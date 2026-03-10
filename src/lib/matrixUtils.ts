/**
 * Utilities for merging matrix strategy entries.
 * Preserves homogeneous types (string[] | number[]) and dedupes by string equality.
 */

export type MatrixRecord = Record<string, string[] | number[]>

/**
 * Merges incoming values into a matrix entry. Trims values, coerces to numbers
 * when the existing array is numeric, dedupes by string equality, and ignores
 * NaN when coercing. Returns a new matrix (does not mutate the input).
 *
 * @param matrix - The current strategy matrix
 * @param key - The matrix variable name
 * @param incomingValues - Raw string values (will be trimmed; empty strings filtered out)
 * @returns A new matrix with the merged entry
 */
export function mergeMatrixEntry(
  matrix: MatrixRecord,
  key: string,
  incomingValues: string[]
): MatrixRecord {
  const values = incomingValues.map((v) => v.trim()).filter(Boolean)
  if (values.length === 0) return { ...matrix }

  const newMatrix = { ...matrix }
  const existing = newMatrix[key]

  if (!existing || !Array.isArray(existing)) {
    newMatrix[key] = values
    return newMatrix
  }

  const existingSet = new Set(existing.map(String))
  const isNumeric = existing.length > 0 && typeof existing[0] === 'number'
  const toAdd = isNumeric
    ? values
        .filter((v) => !existingSet.has(v))
        .map((v) => Number(v))
        .filter((n) => !Number.isNaN(n))
    : values.filter((v) => !existingSet.has(v))

  newMatrix[key] = [...existing, ...toAdd] as string[] | number[]
  return newMatrix
}
