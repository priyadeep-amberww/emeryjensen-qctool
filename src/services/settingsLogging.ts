import type { AppendLogInput } from '../types/log'

type AppendLog = (input: AppendLogInput) => void

export function logSettingUpdated(appendLog: AppendLog, detail: string) {
  appendLog({
    category: 'SETTINGS',
    message: 'Setting updated',
    detail,
  })
}

export function logSettingsReset(appendLog: AppendLog) {
  appendLog({
    category: 'SETTINGS',
    message: 'Settings reset to defaults',
    detail:
      'Title Similarity 70% · Image Similarity 70% · Vendor Login Required ON · Error Engine ON (4 retries) · Reuse Vendor Session ON · Headless Scraping ON',
  })
}
