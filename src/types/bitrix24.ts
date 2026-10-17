/** Bitrix24 notification trigger identifiers (outbound messages only). */
export type Bitrix24TriggerId =
  | 'batchStart'
  | 'progress'
  | 'halfway'
  | 'periodicStatus'
  | 'error'
  | 'batchPause'
  | 'batchStop'
  | 'batchComplete'

export type Bitrix24ChannelPreference = 'group_chat' | 'user' | 'open_channel'

export type Bitrix24TriggerToggles = Record<Bitrix24TriggerId, boolean>

export type Bitrix24MessageTemplates = Record<Bitrix24TriggerId, string>

export type Bitrix24Settings = {
  /** Master switch for sending Bitrix24 notifications. */
  enabled: boolean
  triggers: Bitrix24TriggerToggles
  templates: Bitrix24MessageTemplates
  /** Send progress notification every N completed SKUs. */
  progressSkuInterval: number
  /** Send periodic status every N minutes while batch is running. */
  periodicStatusMinutes: number
}

export const BITRIX24_TRIGGER_LABELS: Record<Bitrix24TriggerId, string> = {
  batchStart: 'Batch start',
  progress: 'Progress (every N SKUs)',
  halfway: 'Halfway (50%)',
  periodicStatus: 'Periodic status',
  error: 'Errors / failures',
  batchPause: 'Batch pause',
  batchStop: 'Batch stop',
  batchComplete: 'Batch complete (summary)',
}

export const BITRIX24_TEMPLATE_VARIABLES = [
  '{completed_count}',
  '{total_count}',
  '{pass_rate}',
  '{status}',
  '{elapsed_time}',
  '{batch_label}',
  '{error_message}',
] as const
