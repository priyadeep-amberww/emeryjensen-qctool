import type { Bitrix24MessageTemplates, Bitrix24TriggerId } from '../../types/bitrix24'

export const DEFAULT_BITRIX24_TEMPLATES: Bitrix24MessageTemplates = {
  batchStart:
    '🚀 QC batch {batch_label} started\nStatus: {status}\nTotal SKUs: {total_count}',
  progress:
    '⏳ QC progress — {batch_label}\n{completed_count}/{total_count} SKUs · Pass rate {pass_rate}%\nElapsed: {elapsed_time}',
  halfway:
    '½ QC batch {batch_label} is 50% complete\n{completed_count}/{total_count} · Pass rate {pass_rate}%',
  periodicStatus:
    '📊 QC status update — {batch_label}\n{completed_count}/{total_count} · {status}\nPass rate {pass_rate}% · Elapsed {elapsed_time}',
  error:
    '⚠️ QC error — {batch_label}\n{error_message}\nProgress: {completed_count}/{total_count}',
  batchPause: '⏸ QC batch {batch_label} paused at {completed_count}/{total_count}',
  batchStop: '⏹ QC batch {batch_label} stopped at {completed_count}/{total_count}',
  batchComplete:
    '✅ QC batch {batch_label} complete\n{completed_count}/{total_count} SKUs · Pass rate {pass_rate}%\nElapsed: {elapsed_time}',
}

export const BITRIX24_TRIGGER_IDS: Bitrix24TriggerId[] = [
  'batchStart',
  'progress',
  'halfway',
  'periodicStatus',
  'error',
  'batchPause',
  'batchStop',
  'batchComplete',
]
