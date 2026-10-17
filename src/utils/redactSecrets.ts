const SECRET_PATTERNS =
  /(?:sk-[a-zA-Z0-9_-]{8,}|xox[baprs]-\S+|Bearer\s+\S+|password[=:]\s*\S+|api[_-]?key[=:]\s*\S+)/gi

/** Strip likely secrets from user-visible or log strings. */
export function redactSecrets(text: string): string {
  return text.replace(SECRET_PATTERNS, '[redacted]')
}
