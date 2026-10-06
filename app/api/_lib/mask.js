// Strip personal data before text is sent to a third-party LLM. The original text is
// still stored in Firestore for the admin; only the prompt is masked.

const PHONE = /(?:\+?977[\s-]?)?\b9[678]\d[\s-]?\d{3}[\s-]?\d{4}\b/g
const LONG_NUMBER = /\b\d[\d\s-]{7,}\d\b/g
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/g
// "address: Baneshwor-10, near ..." / "thegana Pokhara ..." → keep the label, hide the rest.
// A bare city ("delivery Pokhara ma kati?") is left alone — the bot needs it for charges.
const ADDRESS = /(address|addr|thegana|ठेगाना)\s*(?:[:\-–]|is|ho)?\s*[^\n.?!]{3,80}/gi

export function maskPII(text) {
  return (text || '')
    .replace(EMAIL, '[email]')
    .replace(PHONE, '[phone]')
    .replace(LONG_NUMBER, '[number]')
    .replace(ADDRESS, (_, label) => `${label} [address]`)
}
