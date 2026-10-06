// Facebook Messenger via the Page's Send API. Needs PAGE_ACCESS_TOKEN.
// Standard messaging is allowed for 24h after the customer's last message.
import { graphFetch, requireEnv, clip, GRAPH_VERSION, DAY_MS } from './graph.js'

export default {
  replyWindowMs: DAY_MS,

  async send({ externalUserId, text }) {
    const data = await graphFetch(`https://graph.facebook.com/${GRAPH_VERSION()}/me/messages`, {
      method: 'POST',
      token: requireEnv('PAGE_ACCESS_TOKEN'),
      body: {
        recipient: { id: externalUserId },
        messaging_type: 'RESPONSE',
        message: { text: clip(text, 2000) },
      },
    })
    return { messageId: data.message_id }
  },

  async fetchProfile({ externalUserId }) {
    const p = await graphFetch(
      `https://graph.facebook.com/${GRAPH_VERSION()}/${externalUserId}?fields=first_name,last_name`,
      { token: requireEnv('PAGE_ACCESS_TOKEN') })
    return { name: [p.first_name, p.last_name].filter(Boolean).join(' ') }
  },
}
