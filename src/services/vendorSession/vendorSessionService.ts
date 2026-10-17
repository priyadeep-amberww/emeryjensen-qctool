export type VendorLoginRequest = {
  vendorLoginRequired: boolean
  reuseSession: boolean
  headless: boolean
  batchLabel?: string
}

export type VendorLoginResult = { ok: true } | { ok: false; error: string }

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/** In-process vendor login (web / dev). Electron uses IPC via vendorSessionApi. */
export async function performVendorLoginInProcess(
  request: VendorLoginRequest,
): Promise<VendorLoginResult> {
  if (!request.vendorLoginRequired) {
    return { ok: true }
  }
  await delay(80)
  return { ok: true }
}
