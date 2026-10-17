export type VendorSessionPhase =
  | 'idle'
  | 'logging_in'
  | 'armed'
  | 'logged_out'
  | 'relogging'

export type VendorSessionStatus = {
  state: VendorSessionPhase
  armed: boolean
  message?: string
  activeStore?: string
}

const FALLBACK_STATUS: VendorSessionStatus = {
  state: 'idle',
  armed: false,
}

function bridge() {
  return typeof window !== 'undefined' ? window.electronAPI?.vendorSession : undefined
}

export async function fetchVendorSessionStatus(): Promise<VendorSessionStatus> {
  const api = bridge()
  if (!api?.status) {
    return FALLBACK_STATUS
  }
  try {
    return await api.status()
  } catch {
    return FALLBACK_STATUS
  }
}

export function vendorSessionStatusLabel(status: VendorSessionStatus): string {
  switch (status.state) {
    case 'armed':
      return status.activeStore ? `Armed · Store ${status.activeStore}` : 'Armed'
    case 'logging_in':
      return 'Logging in…'
    case 'relogging':
      return 'Relogging…'
    case 'logged_out':
      return 'Logged out'
    default:
      return status.armed ? 'Armed' : 'Not armed'
  }
}
