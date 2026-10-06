// Small helpers for the Vercel Node functions.
import { adminAuth } from './admin.js'

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

/**
 * Verify the Firebase ID token sent by the admin UI (Authorization: Bearer <token>).
 * Sign-up is disabled in Firebase Auth, so any valid user of this project is the admin.
 * Set ADMIN_EMAILS (comma-separated) to restrict it further.
 */
export async function requireAdmin(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '')
  if (!m) throw new HttpError(401, 'Missing ID token')
  let decoded
  try {
    decoded = await adminAuth().verifyIdToken(m[1])
  } catch {
    throw new HttpError(401, 'Invalid or expired ID token')
  }
  const allow = (process.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  if (allow.length && !allow.includes((decoded.email || '').toLowerCase())) {
    throw new HttpError(403, 'Not an admin')
  }
  return decoded
}

// Read the unparsed request body (needed for Meta's HMAC signature check).
export async function rawBody(req) {
  const chunks = []
  for await (const c of req) chunks.push(typeof c === 'string' ? Buffer.from(c) : c)
  return Buffer.concat(chunks)
}

export function sendError(res, e) {
  const status = e instanceof HttpError ? e.status : 500
  if (status === 500) console.error(e)
  res.status(status).json({ error: e.message || 'Server error' })
}
