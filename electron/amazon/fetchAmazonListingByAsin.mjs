import { getDecryptedValues } from '../credentialsStore.mjs'
import { fetchLwaAccessToken } from './lwaToken.mjs'
import { normalizeAmazonListing } from './normalizeAmazonListing.mjs'
import {
  DEFAULT_MARKETPLACE_ID,
  SP_API_RUNTIME_KEYS,
} from './spApiCredentialKeys.mjs'
import { formatMissingSpApiLwaFields, spApiLwaGet } from './spApiLwaRequest.mjs'

const ASIN_RE = /^B[0-9A-Z]{9}$/i

/**
 * @param {string} asin
 * @returns {Promise<{ ok: true, extract: import('./normalizeAmazonListing.mjs').AmazonListingExtract } | { ok: false, kind: string, error: string }>}
 */
export async function fetchAmazonListingByAsin(asin) {
  const normalizedAsin = String(asin ?? '').trim().toUpperCase()
  if (!ASIN_RE.test(normalizedAsin)) {
    return { ok: false, kind: 'parse', error: `Invalid ASIN: ${asin}` }
  }

  const values = await getDecryptedValues(SP_API_RUNTIME_KEYS)
  const missingFields = formatMissingSpApiLwaFields(values)
  if (missingFields) {
    return { ok: false, kind: 'credentials', error: missingFields }
  }

  const marketplaceId = values.SP_API_MARKETPLACE_ID?.trim() || DEFAULT_MARKETPLACE_ID

  const lwa = await fetchLwaAccessToken({
    clientId: values.SP_API_CLIENT_ID,
    clientSecret: values.SP_API_CLIENT_SECRET,
    refreshToken: values.SP_API_REFRESH_TOKEN,
  })
  if (!lwa.ok) {
    return { ok: false, kind: 'credentials', error: lwa.error }
  }

  const query = new URLSearchParams({
    marketplaceIds: marketplaceId,
    includedData: 'summaries,images,attributes,identifiers',
  }).toString()

  const path = `/catalog/2022-04-01/items/${encodeURIComponent(normalizedAsin)}`
  const catalog = await spApiLwaGet({
    accessToken: lwa.accessToken,
    path,
    query,
  })

  if (!catalog.ok) {
    const kind =
      catalog.status === 403 || catalog.status === 401 ? 'credentials' : 'network'
    return { ok: false, kind, error: catalog.error }
  }

  const extract = normalizeAmazonListing(normalizedAsin, marketplaceId, catalog.json)
  return { ok: true, extract, catalogJson: catalog.json }
}
