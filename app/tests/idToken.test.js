import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SignJWT, generateKeyPair, exportJWK, createLocalJWKSet } from 'jose'
import { verifyFirebaseIdToken } from '../api/_lib/idToken.js'

const PROJECT = 'motovia-test'
const { publicKey, privateKey } = await generateKeyPair('RS256')
const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' }
const keySet = createLocalJWKSet({ keys: [jwk] })
const now = Math.floor(Date.now() / 1000)
const sign = (claims, key = privateKey) => new SignJWT({ auth_time: now, email: 'admin@x.com', ...claims })
  .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
  .setIssuer(claims.iss ?? `https://securetoken.google.com/${PROJECT}`)
  .setAudience(claims.aud ?? PROJECT).setSubject(claims.sub ?? 'uid123')
  .setIssuedAt(now - 10).setExpirationTime(claims.exp ?? now + 3600).sign(key)

test('valid Firebase ID token is accepted', async () => {
  const p = await verifyFirebaseIdToken(await sign({}), PROJECT, keySet)
  assert.equal(p.uid, 'uid123'); assert.equal(p.email, 'admin@x.com')
})

test('expired, wrong project, wrong issuer and forged tokens are rejected', async () => {
  const other = (await generateKeyPair('RS256')).privateKey
  for (const [label, tok] of [
    ['expired', await sign({ exp: now - 60 })],
    ['other project', await sign({ aud: 'someone-else' })],
    ['wrong issuer', await sign({ iss: 'https://evil.example' })],
    ['forged signature', await sign({}, other)],
  ]) await assert.rejects(verifyFirebaseIdToken(tok, PROJECT, keySet), undefined, label)
})
