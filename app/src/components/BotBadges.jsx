// Small badges shared by the Inbox, conversation view and Test Bot.

const LAYER_LABEL = { llm: 'AI', keyword: 'keyword', template: 'template', fallback: 'fallback', admin: 'you' }
export const PLATFORM_ICON = {
  messenger: '💬', instagram: '📸', whatsapp: '🟢', tiktok: '🎵', test: '🧪',
}
export const PLATFORM_LABEL = {
  messenger: 'Messenger', instagram: 'Instagram', whatsapp: 'WhatsApp', tiktok: 'TikTok',
}

export function LangBadge({ lang }) {
  if (!lang) return null
  return <span className={`badge lang-${lang}`}>{lang === 'ne' ? 'Nepali' : 'English'}</span>
}

export function LayerBadge({ layer }) {
  if (!layer) return null
  return <span className={`badge layer-${layer}`}>{LAYER_LABEL[layer] || layer}</span>
}
