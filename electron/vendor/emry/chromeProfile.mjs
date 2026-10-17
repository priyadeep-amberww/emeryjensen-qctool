import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

const PROFILE_DIR_NAME = 'emry-qc-tool/chrome-profile'

/**
 * Stable Chrome user-data directory for headed EJD portal sessions.
 * Separate from per-process Electron userData in main.mjs.
 */
export function getEmryChromeProfilePath() {
  const base = app.getPath('appData')
  const profilePath = path.join(base, PROFILE_DIR_NAME)
  fs.mkdirSync(profilePath, { recursive: true })
  return profilePath
}
