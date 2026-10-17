import type { AppendLogInput } from '../types/log'
import { redactSecrets } from '../utils/redactSecrets'

type AppendLog = (input: AppendLogInput) => void

export function logCredentialEvent(
  appendLog: AppendLog,
  message: string,
  detail?: string,
  category: AppendLogInput['category'] = 'CREDENTIALS',
) {
  appendLog({
    category,
    message: redactSecrets(message),
    detail: detail ? redactSecrets(detail) : undefined,
  })
}
