// Cheap, LLM-free language detection for customer messages.
//
//   'ne' — Nepali in Devanagari, Romanized Nepali, or a Nepali/English mix
//   'en' — English
//
// Replies to 'ne' are always written in Romanized Nepali (see llm.js prompt).

const DEVANAGARI = /[ऀ-ॿ]/

// Romanized Nepali words that almost never appear in English messages.
const STRONG_NE = new Set([
  'ho', 'hoina', 'cha', 'chha', 'xa', 'chaina', 'chhaina', 'xaina', 'kati', 'katti',
  'ko', 'lai', 'garna', 'garnu', 'garne', 'garnus', 'garnuhos', 'gardinus', 'garchhu',
  'aaucha', 'aauchha', 'aaucha', 'auxa', 'aucha', 'auchha', 'aaunchha', 'hunchha',
  'huncha', 'hunxa', 'hola', 'parcha', 'parchha', 'parxa', 'lagcha', 'lagchha', 'lagxa',
  'paincha', 'painchha', 'painxa', 'pathaunus', 'pathaidinus', 'dinus', 'dinuhos',
  'kasari', 'kaha', 'kahile', 'kina', 'kun', 'kunai', 'ke', 'kei', 'kk', 'kehi', 'tapai',
  'tapaiko', 'hajur', 'malai', 'mero', 'hamro', 'yo', 'tyo', 'yesko', 'tyesko', 'ani',
  'pani', 'ra', 'ni', 'ta', 'ma', 'k', 'din', 'paisa', 'rakhnus', 'rakhnu', 'chahiyo',
  'chainchha', 'chaincha', 'chahincha', 'kinna', 'kinne', 'dherai', 'thik', 'sanchai',
  'dai', 'didi', 'bhai', 'bahini', 'namaste', 'namaskar', 'dhanyabad', 'dhanyabaad',
  'xu', 'chu', 'chhu', 'bhayo', 'vayo', 'bhaye', 'vaye', 'sakchu', 'sakincha', 'saknu',
  'aaja', 'bholi', 'aile', 'ahile', 'ekdam', 'ramro', 'mitho', 'sasto', 'mahango',
])

// Short words that are Nepali in this context but collide with English slang/initials
// ("k" = okay, "ma" = mom, "ta", "ni", "ra", "ke", "yo"). They only count half.
const WEAK_NE = new Set(['k', 'ma', 'ta', 'ni', 'ra', 'ke', 'yo', 'din', 'pani'])

// Function words that signal English.
const EN_WORDS = new Set([
  'the', 'is', 'are', 'was', 'what', 'how', 'do', 'does', 'did', 'can', 'could', 'you',
  'your', 'i', 'my', 'me', 'please', 'have', 'has', 'much', 'many', 'when', 'where',
  'which', 'want', 'need', 'thanks', 'thank', 'it', 'this', 'that', 'there', 'will',
  'would', 'of', 'to', 'for', 'and', 'or', 'with', 'in', 'on', 'long', 'take', 'days',
  'available', 'deliver', 'buy', 'order', 'a', 'an', 'be', 'any', 'still', 'if',
])

const NE_SUFFIX = /(chha|cha|xa|nuhuncha|nuhunchha|nuhos|garnus|dinus|aunus|incha|inchha)$/

const tokenize =(text) =>
  (text || '').toLowerCase().normalize('NFKC').match(/[a-z]+/g) || []

/**
 * Detect the reply language for one message.
 * @param {string} text
 * @param {string} [previous] language of the conversation so far, used when the
 *   message carries no signal at all (e.g. "FoamX?", "1499", "👍").
 * @returns {{ language: 'ne'|'en', method: string, ne: number, en: number }}
 */
export function detectLanguage(text, previous) {
  if (DEVANAGARI.test(text || '')) return { language: 'ne', method: 'devanagari', ne: 1, en: 0 }

  let ne = 0
  let en = 0
  for (const w of tokenize(text)) {
    if (STRONG_NE.has(w)) ne += WEAK_NE.has(w) ? 0.5 : 1
    else if (EN_WORDS.has(w)) en += 1
    // Conjugated verbs the list can't enumerate: garnuhuncha, pathaidinus, milchha…
    else if (w.length >= 5 && NE_SUFFIX.test(w)) ne += 1
  }

  if (ne === 0 && en === 0) {
    return { language: previous === 'ne' ? 'ne' : 'en', method: 'no-signal', ne, en }
  }
  // Mixed Nepali/English → Romanized Nepali. One strong Nepali word is enough unless
  // the message is overwhelmingly English ("is the combo ok? k" stays English).
  if (ne >= 1 && ne * 3 >= en) return { language: 'ne', method: 'heuristic', ne, en }
  return { language: 'en', method: 'heuristic', ne, en }
}

const GREETINGS_NE = new Set([
  'namaste', 'namaskar', 'namasté', 'नमस्ते', 'नमस्कार', 'hajur', 'dai', 'didi',
])
const GREETINGS_ANY = new Set([
  'hi', 'hii', 'hiii', 'hello', 'helo', 'hlo', 'hey', 'heyy', 'yo', 'good morning',
  'good afternoon', 'good evening', 'hi there', 'hello there', 'hi dai', 'hello dai',
  'hi didi', 'hello didi', 'hi hajur', 'namaste dai', 'namaste didi', 'namaste hajur',
])

/**
 * Is this message ONLY a greeting (answerable from a template, no LLM call)?
 * Returns 'ne' | 'en' | null — the language the greeting itself suggests.
 */
export function greetingLanguage(text) {
  const t = (text || '').toLowerCase().replace(/[!.?,🙏😊🙂👋\s]+/gu, ' ').trim()
  if (!t) return null
  if (GREETINGS_NE.has(t) || /^(namaste|namaskar|नमस्ते|नमस्कार)( (dai|didi|hajur|ji))?$/.test(t)) return 'ne'
  if (GREETINGS_ANY.has(t)) return /\b(dai|didi|hajur)\b/.test(t) ? 'ne' : 'en'
  return null
}

export const hasDevanagari = (text) => DEVANAGARI.test(text || '')
