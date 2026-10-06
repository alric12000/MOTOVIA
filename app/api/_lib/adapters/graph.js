// Minimal Meta Graph API client shared by the Messenger / Instagram / WhatsApp adapters.
export const GRAPH_VERSION = () => process.env.META_GRAPH_VERSION || 'v23.0'
export const DAY_MS = 24 * 60 * 60 * 1000

export async function graphFetch(url, { method = 'GET', token, body } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10_000),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.error) {
    const e = new Error(data.error?.message || `Graph API HTTP ${res.status}`)
    e.status = res.status
    e.code = data.error?.code
    throw e
  }
  return data
}

export function requireEnv(name) {
  const v = process.env[name]
  if (!v) throw new Error(`${name} is not set`)
  return v
}

// Platforms cap message length; cut at a word boundary.
export function clip(text, max) {
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 50)) + '…'
}
