import { useMemo, useState } from 'react'
import { addDoc, collection, deleteDoc, doc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useCollection, useDoc } from '../lib/useCollection'
import { DEFAULT_SETTINGS } from '../lib/constants'
import { formatNPR } from '../lib/calc'

export default function AdSpend() {
  const { data: adSpend } = useCollection('ad_spend')
  const { data: settingsDoc } = useDoc('settings', 'config')
  const settings = settingsDoc || DEFAULT_SETTINGS

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    platform: '', campaign: '', amount: '', notes: '',
  })
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const sorted = useMemo(
    () => [...adSpend].sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [adSpend]
  )
  const total = sorted.reduce((s, a) => s + (Number(a.amount) || 0), 0)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await addDoc(collection(db, 'ad_spend'), {
        date: form.date,
        platform: form.platform || 'Other',
        campaign: form.campaign.trim(),
        amount: Number(form.amount) || 0,
        notes: form.notes.trim(),
      })
      setForm((f) => ({ ...f, campaign: '', amount: '', notes: '' }))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id) => {
    if (window.confirm('Delete this ad spend entry?')) await deleteDoc(doc(db, 'ad_spend', id))
  }

  return (
    <div className="page">
      <h1>Ad Spend</h1>
      <form onSubmit={submit} className="card">
        <div className="row">
          <div>
            <label>Date</label>
            <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
          </div>
          <div>
            <label>Platform</label>
            <select value={form.platform} onChange={(e) => set('platform', e.target.value)}>
              <option value="">Select…</option>
              {settings.ad_platforms.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <label>Campaign</label>
        <input value={form.campaign} onChange={(e) => set('campaign', e.target.value)} />
        <div className="row">
          <div>
            <label>Amount (Rs)</label>
            <input type="number" min="0" value={form.amount}
              onChange={(e) => set('amount', e.target.value)} inputMode="decimal" required />
          </div>
        </div>
        <label>Notes / objective</label>
        <input value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        <button className="btn" style={{ marginTop: 14 }} disabled={busy}>Add ad spend</button>
      </form>

      <h2>Total: {formatNPR(total)}</h2>
      {sorted.map((a) => (
        <div className="card" key={a.id}>
          <div className="list-item" style={{ paddingTop: 0 }}>
            <div className="grow">
              <div className="title">{a.platform} {a.campaign && `· ${a.campaign}`}</div>
              <div className="sub">{a.date}{a.notes && ` · ${a.notes}`}</div>
            </div>
            <div className="right">
              <div className="title">{formatNPR(a.amount)}</div>
              <button className="btn ghost sm no-print" onClick={() => remove(a.id)}>Delete</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
