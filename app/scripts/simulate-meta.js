// Send a signed, Messenger-shaped webhook event to the local API, exactly as Meta would.
//   npm run simulate:meta -- "foamx kati ho?"            (fake sender — reply send will fail,
//                                                          which shows up as last_error in Inbox)
//   npm run simulate:meta -- "foamx kati ho?" <PSID>     (real tester PSID — reply is delivered)
// Reads META_APP_SECRET from .env.local like the API server does.
import crypto from 'node:crypto'
import fs from 'node:fs'

for (const line of fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8').split(/\r?\n/) : []) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
}
const secret = process.env.META_APP_SECRET
if (!secret) { console.error('Set META_APP_SECRET in .env.local'); process.exit(1) }

const [text = 'foamx kati ho?', psid = 'LOCAL_TEST_USER'] = process.argv.slice(2)
const body = JSON.stringify({
  object: 'page',
  entry: [{ id: 'LOCAL_PAGE', time: Date.now(), messaging: [{
    sender: { id: psid }, recipient: { id: 'LOCAL_PAGE' }, timestamp: Date.now(),
    message: { mid: `m_local_${Date.now()}`, text },
  }] }],
})
const sig = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex')
const port = process.env.API_PORT || 3001
const res = await fetch(`http://localhost:${port}/api/webhooks/meta`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': sig }, body,
})
console.log(res.status, await res.text(), '→ check the Inbox')
