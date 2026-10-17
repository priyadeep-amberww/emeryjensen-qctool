/** True when the renderer is running inside Electron with the preload bridge attached. */
export function isElectronDesktop(): boolean {
  return typeof window !== 'undefined' && Boolean(window.electronAPI?.platform)
}

export function hasElectronCredentialsBridge(): boolean {
  return isElectronDesktop() && Boolean(window.electronAPI?.credentials)
}
