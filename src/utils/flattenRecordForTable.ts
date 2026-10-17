export type FlattenedFieldRow = {
  path: string
  value: string
}

function stringifyLeaf(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function walk(value: unknown, prefix: string, out: FlattenedFieldRow[]): void {
  if (value === null || value === undefined) {
    if (prefix) out.push({ path: prefix, value: stringifyLeaf(value) })
    return
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      out.push({ path: prefix || '(root)', value: '[]' })
      return
    }
    value.forEach((item, index) => {
      const next = prefix ? `${prefix}[${index}]` : `[${index}]`
      if (item !== null && typeof item === 'object') {
        walk(item, next, out)
      } else {
        out.push({ path: next, value: stringifyLeaf(item) })
      }
    })
    return
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) {
      out.push({ path: prefix || '(root)', value: '{}' })
      return
    }
    for (const [key, child] of entries) {
      const next = prefix ? `${prefix}.${key}` : key
      if (child !== null && typeof child === 'object') {
        walk(child, next, out)
      } else {
        out.push({ path: next, value: stringifyLeaf(child) })
      }
    }
    return
  }

  out.push({ path: prefix || '(root)', value: stringifyLeaf(value) })
}

/** Flatten arbitrary JSON into dot-path rows for tabular display. */
export function flattenRecordForTable(data: unknown): FlattenedFieldRow[] {
  if (data == null) return []
  const rows: FlattenedFieldRow[] = []
  walk(data, '', rows)
  rows.sort((a, b) => a.path.localeCompare(b.path))
  return rows
}

export type MergedFlattenRow = {
  path: string
  amazon: string
  vendor: string
}

export function mergeFlattenedRecords(
  amazonData: unknown,
  vendorData: unknown,
): MergedFlattenRow[] {
  const amazonMap = new Map(flattenRecordForTable(amazonData).map((r) => [r.path, r.value]))
  const vendorMap = new Map(flattenRecordForTable(vendorData).map((r) => [r.path, r.value]))
  const paths = [...new Set([...amazonMap.keys(), ...vendorMap.keys()])].sort((a, b) =>
    a.localeCompare(b),
  )
  return paths.map((path) => ({
    path,
    amazon: amazonMap.get(path) ?? '',
    vendor: vendorMap.get(path) ?? '',
  }))
}
