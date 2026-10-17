import { nativeImage } from 'electron'

const MAX_EDGE = 512

function isUsableUrl(url) {
  const u = String(url ?? '').trim()
  return u && u !== '—' && /^https?:\/\//i.test(u)
}

async function fetchImageBuffer(url) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(20_000),
    headers: { 'User-Agent': 'EMRY-QC-Tool/1.0' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const ab = await res.arrayBuffer()
  return Buffer.from(ab)
}

/**
 * Resize to fit within maxEdge and return JPEG base64 for Anthropic image blocks.
 * @returns {Promise<{ mediaType: 'image/jpeg', data: string } | null>}
 */
export async function fetchAndResizeImageBase64(url) {
  if (!isUsableUrl(url)) return null
  try {
    const buffer = await fetchImageBuffer(url)
    const image = nativeImage.createFromBuffer(buffer)
    if (image.isEmpty()) return null
    const size = image.getSize()
    const scale = Math.min(1, MAX_EDGE / Math.max(size.width, size.height, 1))
    const targetW = Math.max(1, Math.round(size.width * scale))
    const targetH = Math.max(1, Math.round(size.height * scale))
    const resized =
      scale < 1 ? image.resize({ width: targetW, height: targetH }) : image
    const jpeg = resized.toJPEG(82)
    if (!jpeg || jpeg.length === 0) return null
    return {
      mediaType: 'image/jpeg',
      data: jpeg.toString('base64'),
    }
  } catch {
    return null
  }
}

export { isUsableUrl }
