import net from 'node:net'

const TARGETS = [
  { host: '1.1.1.1', port: 443 },
  { host: '8.8.8.8', port: 443 },
]

function probe(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port })
    let settled = false
    const finish = (online) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(online)
    }
    socket.setTimeout(timeoutMs)
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false))
    socket.once('error', () => finish(false))
  })
}

/** TCP connect to public resolvers. True only when at least one probe succeeds. */
export async function pingInternet(timeoutMs = 4000) {
  const results = await Promise.all(TARGETS.map((target) => probe(target.host, target.port, timeoutMs)))
  return results.some(Boolean)
}
