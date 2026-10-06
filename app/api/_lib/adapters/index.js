// Platform adapters. Every adapter exposes the same interface:
//   send({ externalUserId, accountId, text }) → { messageId }
//   replyWindowMs   how long after the customer's last message we may reply freely
//   fetchProfile?({ externalUserId }) → { name } | null
import messenger from './messenger.js'
import instagram from './instagram.js'
import whatsapp from './whatsapp.js'
import tiktok from './tiktok.js'

const adapters = { messenger, instagram, whatsapp, tiktok }

export function getAdapter(platform) {
  const a = adapters[platform]
  if (!a) throw new Error(`No adapter for platform "${platform}"`)
  return a
}

export function withinReplyWindow(platform, lastInboundAtMs, now = Date.now()) {
  const a = adapters[platform]
  if (!a || !lastInboundAtMs) return false
  return now - lastInboundAtMs < a.replyWindowMs
}
