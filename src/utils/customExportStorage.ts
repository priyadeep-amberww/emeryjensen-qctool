import type { CustomExportConfig, CustomExportTemplate } from '../types/customExport'

const TEMPLATES_KEY = 'grand_qc_custom_export_templates'

function readRaw(): CustomExportTemplate[] {
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CustomExportTemplate[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeRaw(templates: CustomExportTemplate[]) {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates))
}

export function listCustomExportTemplates(): CustomExportTemplate[] {
  return readRaw().sort((a, b) => b.updatedAt - a.updatedAt)
}

export function saveCustomExportTemplate(name: string, config: CustomExportConfig): CustomExportTemplate {
  const trimmed = name.trim()
  if (!trimmed) {
    throw new Error('Template name is required.')
  }
  const templates = readRaw()
  const existing = templates.find((t) => t.name.toLowerCase() === trimmed.toLowerCase())
  const entry: CustomExportTemplate = {
    id: existing?.id ?? `tpl_${Date.now()}`,
    name: trimmed,
    config,
    updatedAt: Date.now(),
  }
  const next = existing
    ? templates.map((t) => (t.id === existing.id ? entry : t))
    : [...templates, entry]
  writeRaw(next)
  return entry
}

export function deleteCustomExportTemplate(id: string) {
  writeRaw(readRaw().filter((t) => t.id !== id))
}
