// Verify Firebase Auth ID tokens without firebase-admin/auth.
//
// firebase-admin/auth pulls in jwks-rsa -> jose (ESM-only) via require(), which Vercel's
// function loader rejects (ERR_REQUIRE_ESM) on every Node version. Firebase ID tokens are
// standard RS256 JWTs, verified here exactly as Google documents:
// https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
import { createRemoteJWKSet, jwtVerify } from 'jose'

const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
let jwks // cached per warm instance; jose handles key rotation and caching

export function projectIdFromEnv() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set')
  return JSON.parse(Buffer.from(raw, 'base64').toString('utf8')).project_id
}

/**
 * Returns the decoded token payload ({ uid, email, ... }) or throws.
 * Checks: RS256 signature from Google's securetoken keys, aud = project id,
 * iss = https://securetoken.google.com/<project id>, exp/iat, non-empty sub.
 */
export async function verifyFirebaseIdToken(token, projectId = projectIdFromEnv(), keySet) {
  jwks ||= createRemoteJWKSet(new URL(JWKS_URL))
  const { payload } = await jwtVerify(token, keySet || jwks, {
    algorithms: ['RS256'],
    audience: projectId,
    issuer: `https://securetoken.google.com/${projectId}`,
  })
  if (!payload.sub) throw new Error('Token has no subject')
  if (typeof payload.auth_time === 'number' && payload.auth_time > Date.now() / 1000 + 60) {
    throw new Error('auth_time is in the future')
  }
  return { ...payload, uid: payload.sub }
}
