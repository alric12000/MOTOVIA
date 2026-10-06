import { useEffect, useState } from 'react'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useDoc } from '../lib/useCollection'
import { DEFAULT_KNOWLEDGE, DEFAULT_BOT_SETTINGS } from '../../shared/botDefaults'

const TEMPLATES = [
  { key: 'greeting_en', label: 'Greeting (English)' },
  { key: 'greeting_ne', label: 'Greeting (Romanized Nepali)' },
  { key: 'fallback_en', label: '"Team will reply soon" (English)' },
  { key: 'fallback_ne', label: '"Team will reply soon" (Romanized Nepali)' },
]

// Editor for bot/knowledge (FAQs) and bot/settings (auto-reply switch + templates).
// Products, prices and payment methods are NOT edited here — the bot reads them live
// from Inventory and Settings.
export default function BotKnowledge() {
  const { data: kDoc, loading: kLoading } = useDoc('bot', 'knowledge')
  const { data: sDoc, loading: sLoading } = useDoc('bot', 'settings')
  const [k, setK] = useState(DEFAULT_KNOWLEDGE)
  const [s, setS] = useState(DEFAULT_BOT_SETTINGS)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => { if (kDoc) setK({ ...DEFAULT_KNOWLEDGE, ...kDoc }) }, [kDoc])
  useEffect(() => { if (sDoc) setS({ ...DEFAULT_BOT_SETTINGS, ...sDoc }) }, [sDoc])

  const editFaq = (i, field, v) => {
    const faqs = [...k.faqs]; faqs[i] = { ...faqs[i], [field]: v }
    setK({ ...k, faqs }); setSaved(false)
  }
  const addFaq = () => {
    setK({ ...k, faqs: [...k.faqs, { key: `custom_${Date.now()}`, label: '', en: '', ne: '' }] })
    setSaved(false)
  }
  const removeFaq = (i) => { setK({ ...k, faqs: k.faqs.filter((_, x) => x !== i) }); setSaved(false) }
  const setField = (setter, obj, key, v) => { setter({ ...obj, [key]: v }); setSaved(false) }

  const save = async () => {
    setErr('')
    try {
      const faqs = k.faqs
        .map((f) => ({ ...f, label: f.label.trim(), en: f.en.trim(), ne: f.ne.trim() }))
        .filter((f) => f.label && (f.en || f.ne))
      await setDoc(doc(db, 'bot', 'knowledge'), { brand_tone: k.brand_tone.trim(), faqs })
      const { id, ...settings } = s
      await setDoc(doc(db, 'bot', 'settings'), settings, { merge: true })
      setSaved(true)
    } catch (e) {
      setErr(e.message)
    }
  }

  if (kLoading || sLoading) return <div className="page"><div className="spinner" /></div>

  return (
    <div className="page">
      <h1>Bot Knowledge</h1>
      <p className="muted small">
        What the auto-reply bot is allowed to say. Prices, bundle contents and stock come live
        from Inventory; payment methods from Settings. Anything not covered here gets a
        "team will reply soon" message and is flagged for you.
      </p>

      {!kDoc && <div className="banner info">Showing defaults — tap Save to store them.</div>}

      <div className="card">
        <label style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text)', fontSize: '0.95rem' }}>
          <input type="checkbox" style={{ width: 'auto' }}
            checked={!!s.auto_reply_enabled}
            onChange={(e) => setField(setS, s, 'auto_reply_enabled', e.target.checked)} />
          Auto-reply enabled (all platforms)
        </label>
        <label>Brand tone</label>
        <textarea value={k.brand_tone} onChange={(e) => setField(setK, k, 'brand_tone', e.target.value)} />
      </div>

      <h2>FAQs</h2>
      {k.faqs.map((f, i) => (
        <div className="card" key={f.key}>
          <div className="row" style={{ alignItems: 'center' }}>
            <input value={f.label} placeholder="Topic" onChange={(e) => editFaq(i, 'label', e.target.value)} />
            <button className="btn ghost sm" style={{ flex: '0 0 auto' }} onClick={() => removeFaq(i)}>✕</button>
          </div>
          <label>English answer</label>
          <textarea value={f.en} onChange={(e) => editFaq(i, 'en', e.target.value)} />
          <label>Romanized Nepali answer</label>
          <textarea value={f.ne} onChange={(e) => editFaq(i, 'ne', e.target.value)} />
        </div>
      ))}
      <button className="btn secondary sm" onClick={addFaq}>+ Add FAQ</button>

      <h2>Reply templates</h2>
      <div className="card">
        {TEMPLATES.map(({ key, label }) => (
          <div key={key}>
            <label>{label}</label>
            <textarea value={s[key] || ''} onChange={(e) => setField(setS, s, key, e.target.value)} />
          </div>
        ))}
      </div>

      {err && <div className="banner error">{err}</div>}
      {saved && <div className="banner success">Saved.</div>}
      <button className="btn" onClick={save}>Save bot knowledge</button>
    </div>
  )
}
