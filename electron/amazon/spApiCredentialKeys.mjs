export const SP_API_LWA_KEYS = [
  'SP_API_CLIENT_ID',
  'SP_API_CLIENT_SECRET',
  'SP_API_REFRESH_TOKEN',
]

export const SP_API_SIGNING_KEYS = [
  'SP_API_AWS_ACCESS_KEY_ID',
  'SP_API_AWS_SECRET_ACCESS_KEY',
  'SP_API_AWS_ROLE_ARN',
]

/** Keys loaded for QC catalog fetch and credential tests (LWA only). */
export const SP_API_RUNTIME_KEYS = [...SP_API_LWA_KEYS, 'SP_API_MARKETPLACE_ID']

/** @deprecated Legacy signing keys; not used by the Credentials UI or QC path. */
export const SP_API_ALL_KEYS = [
  ...SP_API_LWA_KEYS,
  ...SP_API_SIGNING_KEYS,
  'SP_API_MARKETPLACE_ID',
]

export const DEFAULT_MARKETPLACE_ID = 'ATVPDKIKX0DER'

export const SP_API_HOST = 'sellingpartnerapi-na.amazon.com'
export const SP_API_REGION = 'us-east-1'
