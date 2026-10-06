import { auth } from './firebase'

// Call one of our /api functions with the signed-in admin's Firebase ID token.
export async function apiPost(path, body) {
  const user = auth.currentUser
  if (!user) throw new Error('Not signed in')
  const token = await user.getIdToken()
  const res = await fetch(`/api/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || (res.status === 404
      ? 'API not found — run with `vercel dev` (plain `npm run dev` has no /api)'
      : `HTTP ${res.status}`))
  }
  return data
}
