import { useMemo, useState } from 'react'
import { addDoc, collection, deleteDoc, doc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useCollection, useDoc } from '../lib/useCollection'
import { DEFAULT_SETTINGS } from '../lib/constants'
import { formatNPR } from '../lib/calc'

export default function Expenses() {
  const { data: expenses } = useCollection('expenses')
  const { data: settingsDoc } = useDoc('settings', 'config')
  const settings = settingsDoc || DEFAULT_SETTINGS

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    category: '', description: '', amount: '', payment_method: 'Cash',
  })
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const sorted = useMemo(
    () => [...expenses].sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [expenses]
  )
  const total = sorted.reduce((s, e) => s + (Number(e.amount) || 0), 0)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await addDoc(collection(db, 'expenses'), {
        date: form.date,
        category: form.category || 'Other',
        description: form.description.trim(),
        amount: Number(form.amount) || 0,
        payment_method: form.payment_method,
      })
      setForm((f) => ({ ...f, description: '', amount: '' }))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id) => {
    if (window.confirm('Delete this expense?')) await deleteDoc(doc(db, 'expenses', id))
  }

  return (
    <div className="page">
      <h1>Expenses</h1>
      <form onSubmit={submit} className="card">
        <div className="row">
          <div>
            <label>Date</label>
            <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
          </div>
          <div>
            <label>Category</label>
            <select value={form.category} onChange={(e) => set('category', e.target.value)}>
              <option value="">Select…</option>
              {settings.expense_categories.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <label>Description</label>
        <input value={form.description} onChange={(e) => set('description', e.target.value)} />
        <div className="row">
          <div>
            <label>Amount (Rs)</label>
            <input type="number" min="0" value={form.amount}
              onChange={(e) => set('amount', e.target.value)} inputMode="decimal" required />
          </div>
          <div>
            <label>Paid via</label>
            <select value={form.payment_method} onChange={(e) => set('payment_method', e.target.value)}>
              {settings.payment_methods.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <button className="btn" style={{ marginTop: 14 }} disabled={busy}>Add expense</button>
      </form>

      <h2>Total: {formatNPR(total)}</h2>
      {sorted.map((e) => (
        <div className="card" key={e.id}>
          <div className="list-item" style={{ paddingTop: 0 }}>
            <div className="grow">
              <div className="title">{e.description || e.category}</div>
              <div className="sub">{e.date} · {e.category} · {e.payment_method}</div>
            </div>
            <div className="right">
              <div className="title">{formatNPR(e.amount)}</div>
              <button className="btn ghost sm no-print" onClick={() => remove(e.id)}>Delete</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
