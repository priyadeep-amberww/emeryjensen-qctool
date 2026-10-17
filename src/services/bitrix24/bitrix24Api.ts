export type Bitrix24SendMessageRequest = {
  message: string
  dialogId?: string
}

export type Bitrix24SendMessageResponse =
  | { ok: true; messageId?: unknown }
  | { ok: false; error: string }

export type Bitrix24TestConnectionResponse =
  | { ok: true; message?: string }
  | { ok: false; error: string }

function bitrixBridge() {
  return typeof window !== 'undefined' ? window.electronAPI?.bitrix24 : undefined
}

export async function testBitrix24Connection(): Promise<Bitrix24TestConnectionResponse> {
  const bridge = bitrixBridge()
  if (!bridge?.testConnection) {
    return { ok: false, error: 'Bitrix24 API is only available in the desktop app.' }
  }
  return bridge.testConnection()
}

export async function sendBitrix24Message(
  request: Bitrix24SendMessageRequest,
): Promise<Bitrix24SendMessageResponse> {
  const bridge = bitrixBridge()
  if (!bridge?.sendMessage) {
    return { ok: false, error: 'Bitrix24 API is only available in the desktop app.' }
  }
  return bridge.sendMessage(request)
}
