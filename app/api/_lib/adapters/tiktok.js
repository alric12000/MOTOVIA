// TikTok adapter — public replies to comments on your own videos.
// externalUserId is "<videoId>:<commentId>": each top-level comment is one conversation.
//
// DMs (Business Messaging API) are NOT implemented: access is an approval-gated beta,
// region-limited, and its request shapes couldn't be verified. When you get access,
// add a `tiktok_dm` adapter with this same interface (send / replyWindowMs = 48h).
import { replyToComment } from '../tiktok.js'
import { clip } from './graph.js'

export default {
  // Comment replies have no messaging window; cap at 30 days to avoid reviving old threads.
  replyWindowMs: 30 * 24 * 60 * 60 * 1000,
  // Replies are public: inbound.js only posts real answers (no greetings/fallbacks).
  publicReplies: true,

  async send({ externalUserId, text }) {
    const [videoId, commentId] = String(externalUserId).split(':')
    if (!videoId || !commentId) throw new Error('Bad TikTok conversation id')
    return replyToComment({ videoId, commentId, text: clip(text, 150) })
  },
}
