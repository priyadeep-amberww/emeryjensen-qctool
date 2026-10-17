import path from 'node:path'
import os from 'node:os'

const ENV_FILE = 'credentials.env'
const STABLE_DIR_NAME = 'emry-qc-tool'

function appDataDir() {
  if (process.env.APPDATA) return process.env.APPDATA
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support')
  }
  return path.join(os.homedir(), '.config')
}

/**
 * Stable app directory. Also used as Electron userData so safeStorage
 * can decrypt secrets after a restart.
 */
export function getStableCredentialsDir() {
  return path.join(appDataDir(), STABLE_DIR_NAME)
}

export function getStableCredentialsEnvPath() {
  return path.join(getStableCredentialsDir(), ENV_FILE)
}
