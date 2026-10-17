/**
 * Parse EJD RSC / available quantity text. "Available in other warehouses" is not a catalog miss.
 * @param {string} raw
 */
export function parseRscQuantityText(raw) {
  const text = String(raw ?? '').trim()
  if (!text) {
    return { availableQty: 0, availableOtherWarehouses: false }
  }
  if (/other\s+warehouse/i.test(text) || /available\s+elsewhere/i.test(text)) {
    return { availableQty: 0, availableOtherWarehouses: true }
  }
  const n = Number.parseInt(text.replace(/\D/g, ''), 10)
  return {
    availableQty: Number.isFinite(n) ? n : 0,
    availableOtherWarehouses: false,
  }
}
