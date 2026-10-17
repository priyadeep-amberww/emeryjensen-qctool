import { getDecryptedValues } from '../credentialsStore.mjs'
import { fetchLwaAccessToken } from './lwaToken.mjs'
import { DEFAULT_MARKETPLACE_ID, SP_API_RUNTIME_KEYS } from './spApiCredentialKeys.mjs'
import { formatMissingSpApiLwaFields, spApiLwaGet, spApiLwaPost } from './spApiLwaRequest.mjs'

async function tokenAndMarketplace() {
  const values = await getDecryptedValues(SP_API_RUNTIME_KEYS)
  const missing = formatMissingSpApiLwaFields(values)
  if (missing) return { ok: false, error: missing }
  const lwa = await fetchLwaAccessToken({
    clientId: values.SP_API_CLIENT_ID,
    clientSecret: values.SP_API_CLIENT_SECRET,
    refreshToken: values.SP_API_REFRESH_TOKEN,
  })
  if (!lwa.ok) return { ok: false, error: lwa.error }
  return {
    ok: true,
    accessToken: lwa.accessToken,
    marketplaceId: values.SP_API_MARKETPLACE_ID?.trim() || DEFAULT_MARKETPLACE_ID,
  }
}

function readPrice(node) {
  const listing = node?.Price?.ListingPrice ?? node?.ListingPrice
  const amount = listing?.Amount ?? node?.LandedPrice?.Amount
  const n = Number(amount)
  return Number.isFinite(n) ? n : null
}

/**
 * Competitive price for one ASIN. Does not invent a price.
 * @param {string} asin
 */
export async function fetchCompetitivePrice(asin) {
  const auth = await tokenAndMarketplace()
  if (!auth.ok) return auth
  const query = new URLSearchParams({
    MarketplaceId: auth.marketplaceId,
    Asins: asin,
    ItemType: 'Asin',
  }).toString()
  const res = await spApiLwaGet({
    accessToken: auth.accessToken,
    path: '/products/pricing/v0/competitivePrice',
    query,
  })
  if (!res.ok) return { ok: false, error: res.error }
  const payload = res.json?.payload ?? res.json
  const list = Array.isArray(payload) ? payload : []
  const product = list[0]?.Product ?? list[0]
  const prices = product?.CompetitivePricing?.CompetitivePrices ?? []
  const buyBox = prices.find((p) => /buybox|buy_box/i.test(String(p?.CompetitivePriceId ?? p?.condition ?? ''))) ?? prices[0]
  const amount = readPrice(buyBox)
  if (amount == null) return { ok: false, error: 'No competitive Buy Box price returned.' }
  return { ok: true, buyBox: amount, marketplaceId: auth.marketplaceId, accessToken: auth.accessToken }
}

/**
 * @param {string} asin
 * @param {number} price
 * @param {string} marketplaceId
 * @param {string} accessToken
 */
export async function fetchFeeEstimate(asin, price, marketplaceId, accessToken) {
  const body = {
    FeesEstimateRequest: {
      MarketplaceId: marketplaceId,
      PriceToEstimateFees: {
        ListingPrice: { CurrencyCode: 'USD', Amount: price },
      },
      Identifier: asin,
      IsAmazonFulfilled: true,
    },
  }
  const res = await spApiLwaPost({
    accessToken,
    path: `/products/fees/v0/items/${encodeURIComponent(asin)}/feesEstimate`,
    body,
  })
  if (!res.ok) return { ok: false, error: res.error }
  const payload = res.json?.payload ?? res.json
  const fees = payload?.FeesEstimateResult?.FeesEstimate?.FeeDetailList ?? payload?.FeesEstimate?.FeeDetailList ?? []
  let referral = 0
  let fba = 0
  for (const fee of fees) {
    const amount = Number(fee?.FeeAmount?.Amount ?? 0)
    const type = String(fee?.FeeType ?? '')
    if (/Referral/i.test(type)) referral += amount
    if (/FBA/i.test(type)) fba += amount
  }
  return { ok: true, referral, fba }
}
