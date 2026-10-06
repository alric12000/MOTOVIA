// WhatsApp Cloud API. Needs WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID.
// Free-form replies only inside the 24h customer-service window; after that WhatsApp
// requires a pre-approved template (not sent automatically by this bot).
import { graphFetch, requireEnv, clip, GRAPH_VERSION, DAY_MS } from './graph.js'

export default {
  replyWindowMs: DAY_MS,

  async send({ externalUserId, accountId, text }) {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || accountId
    if (!phoneNumberId) throw new Error('WHATSAPP_PHONE_NUMBER_ID is not set')
    const data = await graphFetch(`https://graph.facebook.com/${GRAPH_VERSION()}/${phoneNumberId}/messages`, {
      method: 'POST',
      token: requireEnv('WHATSAPP_TOKEN'),
      body: {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: externalUserId,
        type: 'text',
        text: { body: clip(text, 4096), preview_url: false },
      },
    })
    return { messageId: data.messages?.[0]?.id }
  },
  // Name arrives in the webhook payload (contacts[].profile.name); no lookup needed.
}
