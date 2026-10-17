import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow } from 'electron'
import { registerCredentialsIpc } from './credentialsIpc.mjs'
import { registerErrorEngineIpc } from './errorEngineIpc.mjs'
import { registerVendorSessionIpc } from './vendorSessionIpc.mjs'
import { registerQcExportIpc } from './qcExportIpc.mjs'
import { registerCustomExportIpc } from './export/exportIpc.mjs'
import { registerQcIpc } from './qcIpc.mjs'
import { registerBitrix24Ipc } from './bitrix24Ipc.mjs'
import { getStableCredentialsDir } from './credentialsPath.mjs'
import { dropUndecryptableSecrets } from './credentialsStore.mjs'
import { registerAiTokenCapsIpc } from './aiTokenCapsIpc.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const preloadPath = path.join(__dirname, 'preload.cjs')
const distIndex = path.join(__dirname, '../dist/index.html')

// safeStorage keys are stored under userData. That path must stay the same across
// restarts or previously saved secrets cannot be decrypted.
const stableUserData = getStableCredentialsDir()
try {
  fs.mkdirSync(stableUserData, { recursive: true })
} catch {
  // fall through — Electron will still try the path
}
app.setPath('userData', stableUserData)

// GPU / disk cache stays per process so two dev instances do not lock the same cache files.
const cacheDir = path.join(os.tmpdir(), 'grand-qc-tool-electron-data', `cache-${process.pid}`)
try {
  fs.mkdirSync(cacheDir, { recursive: true })
} catch {
  // ignore
}
app.commandLine.appendSwitch('disk-cache-dir', cacheDir)
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')

// Mitigate blank black windows on some Windows GPU / shared-cache setups.
app.disableHardwareAcceleration()

function loadErrorHtml(message, detail) {
  const safeMessage = String(message ?? 'Failed to load UI')
  const safeDetail = String(detail ?? '')
  return `<!doctype html>
<html><head><meta charset="utf-8"/><title>QC Tool — load error</title>
<style>
  body{margin:0;font-family:Segoe UI,system-ui,sans-serif;background:#0c0c0d;color:#f4f4f5;
    display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}
  .card{max-width:520px;border:1px solid #262629;border-radius:12px;padding:28px;background:#161618}
  h1{font-size:18px;margin:0 0 12px} p{font-size:13px;line-height:1.5;color:#a1a1aa;margin:0 0 10px}
  code{background:#0c0c0d;padding:2px 6px;border-radius:4px;color:#93c5fd}
</style></head><body><div class="card">
  <h1>${safeMessage}</h1>
  <p>${safeDetail}</p>
  <p>Start the app with <code>npm run dev</code> (Vite + Electron). Do not open Electron alone unless <code>dist/</code> was built.</p>
</div></body></html>`
}

async function resolveDevServerUrl() {
  if (process.env.VITE_DEV_SERVER_URL) {
    return process.env.VITE_DEV_SERVER_URL.replace(/\/?$/, '/')
  }

  // Dev convenience: if someone launches Electron without the helper script,
  // try the common Vite ports before falling back to dist.
  const ports = [6137, 5173, 5174, 4173]
  for (const port of ports) {
    const url = `http://127.0.0.1:${port}/`
    try {
      const res = await fetch(url, { method: 'GET' })
      if (res.ok) return url
    } catch {
      // try next
    }
  }
  return null
}

async function createWindow() {
  if (!fs.existsSync(preloadPath)) {
    console.error(`[electron] Preload script missing: ${preloadPath}`)
  }

  const win = new BrowserWindow({
    title: 'EMRY QC Tool',
    width: 1200,
    height: 800,
    show: true,
    backgroundColor: '#0c0c0d',
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  })

  const showLoadError = (message, detail) => {
    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(loadErrorHtml(message, detail))}`)
  }

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`Failed to load: ${errorCode} - ${errorDescription} (${validatedURL})`)
    if (String(validatedURL).startsWith('data:')) return
    showLoadError(
      'UI failed to load',
      `Error ${errorCode}: ${errorDescription}. URL: ${validatedURL || 'unknown'}`,
    )
  })

  win.webContents.on('render-process-gone', (_event, details) => {
    console.error('[electron] Renderer gone:', details)
    showLoadError('Renderer crashed', details?.reason || 'unknown reason')
  })

  try {
    const devUrl = await resolveDevServerUrl()
    if (devUrl) {
      console.log(`[electron] Loading Vite URL: ${devUrl}`)
      await win.loadURL(devUrl)
      if (process.env.ELECTRON_OPEN_DEVTOOLS === '1') {
        win.webContents.openDevTools({ mode: 'detach' })
      }
    } else if (fs.existsSync(distIndex)) {
      console.log(`[electron] Loading packaged UI: ${distIndex}`)
      await win.loadFile(distIndex)
    } else {
      showLoadError(
        'No UI to display',
        'Vite is not running and dist/index.html is missing. Run npm run dev or npm run build.',
      )
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[electron] load failed:', message)
    showLoadError('Could not open the QC Tool UI', message)
  }

  win.once('ready-to-show', () => {
    win.show()
    win.focus()
  })
}

app.on('web-contents-created', (_event, contents) => {
  contents.on('preload-error', (_preloadEvent, failedPath, error) => {
    console.error(`[electron] Preload failed (${failedPath}):`, error)
  })
})

app.whenReady().then(async () => {
  try {
    await dropUndecryptableSecrets()
    registerCredentialsIpc()
    registerQcIpc()
    registerQcExportIpc()
    registerCustomExportIpc()
    registerErrorEngineIpc()
    registerVendorSessionIpc()
    registerBitrix24Ipc()
    registerAiTokenCapsIpc()
  } catch (err) {
    console.error('[electron] IPC registration failed:', err)
  }

  await createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
