import type { VendorLoginRequest, VendorLoginResult } from './vendorSessionService'
import { performVendorLoginInProcess } from './vendorSessionService'

function bridge() {
  return typeof window !== 'undefined' ? window.electronAPI?.vendorSession : undefined
}

export async function exitVendorSession(): Promise<{ ok: boolean; error?: string; log?: string[] }> {
  const api = bridge()
  if (!api?.exit) {
    return { ok: false, error: 'Exit session runs in the desktop app.', log: [] }
  }
  return api.exit()
}

export async function reloginVendorSessionManual(): Promise<
  { ok: true; log?: string[] } | { ok: false; error: string; log?: string[] }
> {
  const api = bridge()
  if (!api?.relogin) {
    return { ok: false, error: 'Relogin runs in the desktop app.', log: [] }
  }
  return api.relogin()
}

export async function performVendorLogin(request: VendorLoginRequest): Promise<VendorLoginResult> {
  const api = bridge()
  if (api?.login) {
    return api.login(request)
  }
  return performVendorLoginInProcess(request)
}
