// Instagram DMs. Two supported setups (see docs/SOCIAL_SETUP.md):
//  A) Instagram API with Instagram Login: IG_ACCESS_TOKEN (+ IG_USER_ID) → graph.instagram.com
//  B) Instagram via the linked Facebook Page: PAGE_ACCESS_TOKEN → graph.facebook.com/me/messages
// Same 24h standard messaging window as Messenger.
import { graphFetch, clip, GRAPH_VERSION, DAY_MS, requireEnv } from './graph.js'

const viaInstagramLogin = () => Boolean(process.env.IG_ACCESS_TOKEN)

export default {
  replyWindowMs: DAY_MS,

  async send({ externalUserId, accountId, text }) {
    const body = { recipient: { id: externalUserId }, message: { text: clip(text, 1000) } }
    const data = viaInstagramLogin()
      ? await graphFetch(
          `https://graph.instagram.com/${GRAPH_VERSION()}/${process.env.IG_USER_ID || accountId || 'me'}/messages`,
          { method: 'POST', token: process.env.IG_ACCESS_TOKEN, body })
      : await graphFetch(`https://graph.facebook.com/${GRAPH_VERSION()}/me/messages`,
          { method: 'POST', token: requireEnv('PAGE_ACCESS_TOKEN'), body })
    return { messageId: data.message_id }
  },

  async fetchProfile({ externalUserId }) {
    const host = viaInstagramLogin() ? 'graph.instagram.com' : 'graph.facebook.com'
    const token = viaInstagramLogin() ? process.env.IG_ACCESS_TOKEN : requireEnv('PAGE_ACCESS_TOKEN')
    const p = await graphFetch(`https://${host}/${GRAPH_VERSION()}/${externalUserId}?fields=name,username`, { token })
    return { name: p.name || (p.username ? `@${p.username}` : '') }
  },
}
