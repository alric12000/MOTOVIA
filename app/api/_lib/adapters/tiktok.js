// TikTok — placeholder until phase D (see docs/SOCIAL_SETUP.md for current API limits).
export default {
  replyWindowMs: 0,
  async send() {
    throw new Error('TikTok sending is not implemented yet')
  },
}
