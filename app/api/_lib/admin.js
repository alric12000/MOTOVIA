// firebase-admin, initialised once per warm function instance.
// FIREBASE_SERVICE_ACCOUNT = base64 of the service-account JSON (server-only env var —
// never prefix it with VITE_, or it would be compiled into the browser bundle).
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

function init() {
  if (getApps().length) return getApps()[0]
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set')
  const json = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'))
  return initializeApp({ credential: cert(json) })
}

let _db
export function adminDb() {
  if (!_db) {
    const app = init()
    _db = process.env.FIREBASE_DATABASE_ID
      ? getFirestore(app, process.env.FIREBASE_DATABASE_ID)
      : getFirestore(app)
  }
  return _db
}

export { FieldValue }
