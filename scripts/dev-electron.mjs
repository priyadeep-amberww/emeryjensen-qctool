import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const TIMEOUT_MS = 45_000
const isWin = process.platform === 'win32'

const viteCli = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')
const electronBin = require('electron')

let viteProc = null
let electronProc = null
let shuttingDown = false
let electronStarted = false

function stripAnsi(text) {
  return text.replace(/\u001b\[[0-9;]*m/g, '')
}

function shutdown(code = 0) {
  if (shuttingDown) return
  shuttingDown = true

  for (const proc of [electronProc, viteProc]) {
    if (!proc || proc.killed || !proc.pid) continue
    try {
      if (isWin) {
        spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], {
          stdio: 'ignore',
          windowsHide: true,
          shell: true,
        })
      } else {
        proc.kill('SIGTERM')
      }
    } catch {
      // ignore cleanup errors
    }
  }

  setTimeout(() => process.exit(code), 300)
}

function startElectron(devUrl) {
  if (electronStarted || shuttingDown) return
  electronStarted = true
  console.log(`Electron loading ${devUrl}`)
  console.log('Use the Electron window for desktop features (credentials encryption, QC IPC).')

  electronProc = spawn(electronBin, ['.'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, VITE_DEV_SERVER_URL: devUrl },
  })

  electronProc.on('exit', (code) => {
    shutdown(code ?? 0)
  })

  electronProc.on('error', (err) => {
    console.error('Failed to start Electron:', err.message)
    shutdown(1)
  })
}

viteProc = spawn(process.execPath, [viteCli], {
  cwd: root,
  env: { ...process.env, BROWSER: 'none' },
  stdio: ['inherit', 'pipe', 'pipe'],
})

const deadline = Date.now() + TIMEOUT_MS

function onViteOutput(chunk, stream) {
  const text = chunk.toString()
  process[stream].write(text)

  if (electronStarted || shuttingDown) return

  const match = stripAnsi(text).match(/Local:\s*(https?:\/\/[^\s]+)/i)
  if (match) {
    startElectron(match[1].replace(/\/$/, '') + '/')
  }
}

viteProc.stdout.on('data', (chunk) => onViteOutput(chunk, 'stdout'))
viteProc.stderr.on('data', (chunk) => onViteOutput(chunk, 'stderr'))

viteProc.on('error', (err) => {
  console.error('Failed to start Vite:', err.message)
  shutdown(1)
})

viteProc.on('exit', (code) => {
  if (!shuttingDown) {
    console.error(`Vite exited unexpectedly (code ${code ?? 0})`)
    shutdown(code ?? 1)
  }
})

const timeout = setInterval(() => {
  if (electronStarted || shuttingDown) {
    clearInterval(timeout)
    return
  }
  if (Date.now() > deadline) {
    console.error('Timed out waiting for Vite to print its Local URL')
    shutdown(1)
  }
}, 500)

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
