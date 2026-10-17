import type { QcEngineEventPayload } from '../qc/qcEngineEventBus'

export function renderBitrix24Template(template: string, payload: QcEngineEventPayload): string {
  const replacements: Record<string, string> = {
    '{completed_count}': String(payload.completed_count),
    '{total_count}': String(payload.total_count),
    '{pass_rate}': String(payload.pass_rate),
    '{status}': payload.status,
    '{elapsed_time}': payload.elapsed_time,
    '{batch_label}': payload.batchLabel ?? 'QC batch',
    '{error_message}': payload.error_message ?? '',
  }

  let out = template
  for (const [token, value] of Object.entries(replacements)) {
    out = out.split(token).join(value)
  }
  return out.trim()
}
