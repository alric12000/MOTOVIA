import { useEffect, useState } from 'react'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useDoc } from '../lib/useCollection'
import { DEFAULT_SETTINGS } from '../lib/constants'

const LISTS = [
  { key: 'platforms', label: 'Platforms' },
  { key: 'payment_methods', label: 'Payment Methods' },
  { key: 'statuses', label: 'Delivery Statuses' },
  { key: 'expense_categories', label: 'Expense Categories' },
  { key: 'ad_platforms', label: 'Ad Platforms' },
]

export default function Settings() {
  const { data: settingsDoc, loading } = useDoc('settings', 'config')
  const [draft, setDraft] = useState(DEFAULT_SETTINGS)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (settingsDoc) setDraft({ ...DEFAULT_SETTINGS, ...settingsDoc })
  }, [settingsDoc])

  const setList = (key, arr) => { setDraft((d) => ({ ...d, [key]: arr })); setSaved(false) }
  const addItem = (key) => setList(key, [...(draft[key] || []), ''])
  const editItem = (key, i, v) => {
    const arr = [...draft[key]]; arr[i] = v; setList(key, arr)
  }
  const removeItem = (key, i) => setList(key, draft[key].filter((_, x) => x !== i))

  const save = async () => {
    const clean = {}
    for (const { key } of LISTS) {
      clean[key] = (draft[key] || []).map((s) => s.trim()).filter(Boolean)
    }
    await setDoc(doc(db, 'settings', 'config'), clean, { merge: true })
    setSaved(true)
  }

  if (loading) return <div className="page"><div className="spinner" /></div>

  return (
    <div className="page">
      <h1>Settings</h1>
      <p className="muted small">
        These lists power every dropdown in the app. Edit them here — no code changes needed.
      </p>

      {LISTS.map(({ key, label }) => (
        <div className="card" key={key}>
          <h2 style={{ marginTop: 0 }}>{label}</h2>
          {(draft[key] || []).map((val, i) => (
            <div className="row" key={i} style={{ marginBottom: 8, alignItems: 'center' }}>
              <input value={val} onChange={(e) => editItem(key, i, e.target.value)} />
              <button className="btn ghost sm" style={{ flex: '0 0 auto' }}
                onClick={() => removeItem(key, i)}>✕</button>
            </div>
          ))}
          <button className="btn secondary sm" onClick={() => addItem(key)}>+ Add {label.slice(0, -1)}</button>
        </div>
      ))}

      {saved && <div className="banner success">Saved.</div>}
      <button className="btn" onClick={save}>Save settings</button>
    </div>
  )
}
