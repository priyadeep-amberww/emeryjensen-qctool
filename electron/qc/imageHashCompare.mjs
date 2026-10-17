import { nativeImage } from 'electron'

const HASH_SIZE = 8

function averageHashFromBuffer(buffer) {
  const image = nativeImage.createFromBuffer(buffer)
  if (image.isEmpty()) return null
  const resized = image.resize({ width: HASH_SIZE, height: HASH_SIZE })
  const bitmap = resized.toBitmap()
  const pixels = []
  for (let i = 0; i < bitmap.length; i += 4) {
    const r = bitmap[i]
    const g = bitmap[i + 1]
    const b = bitmap[i + 2]
    pixels.push((r + g + b) / 3)
  }
  if (pixels.length !== HASH_SIZE * HASH_SIZE) return null
  const avg = pixels.reduce((s, v) => s + v, 0) / pixels.length
  let bits = 0n
  for (let i = 0; i < pixels.length; i++) {
    if (pixels[i] >= avg) bits |= 1n << BigInt(i)
  }
  return bits
}

function hammingDistance(a, b) {
  let x = a ^ b
  let count = 0
  while (x) {
    count += Number(x & 1n)
    x >>= 1n
  }
  return count
}

async function fetchImageBuffer(url) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(15_000),
    headers: { 'User-Agent': 'EMRY-QC-Tool/1.0' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const ab = await res.arrayBuffer()
  return Buffer.from(ab)
}

/**
 * @returns {Promise<{ percent: number } | null>}
 */
export async function compareImageUrlsPercent(sourceUrl, targetUrl) {
  const a = String(sourceUrl ?? '').trim()
  const b = String(targetUrl ?? '').trim()
  if (!a || !b || a === '—' || b === '—') return null
  if (a === b) return { percent: 100 }

  try {
    const [bufA, bufB] = await Promise.all([fetchImageBuffer(a), fetchImageBuffer(b)])
    const hashA = averageHashFromBuffer(bufA)
    const hashB = averageHashFromBuffer(bufB)
    if (hashA == null || hashB == null) return null
    const dist = hammingDistance(hashA, hashB)
    const percent = Math.round(((HASH_SIZE * HASH_SIZE - dist) / (HASH_SIZE * HASH_SIZE)) * 100)
    return { percent }
  } catch {
    return null
  }
}
