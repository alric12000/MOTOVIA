import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCollection, useDoc } from '../lib/useCollection'
import { createOrderWithStock } from '../lib/inventory'
import { DEFAULT_SETTINGS } from '../lib/constants'
import { remainingStock } from '../lib/calc'

export default function OrderEntry() {
  const navigate = useNavigate()
  const { data: products } = useCollection('products')
  const { data: settingsDoc } = useDoc('settings', 'config')
  const settings = settingsDoc || DEFAULT_SETTINGS

  const sellable = useMemo(
    () => products.filter((p) => p.active !== false).sort((a, b) => a.name.localeCompare(b.name)),
    [products]
  )
  const byId = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products])

  const [form, setForm] = useState({
    customer_name: '', phone: '', address: '',
    platform: '', product_id: '', quantity: 1, selling_price: '',
    payment_method: 'COD', status: 'Pending', notes: '',
    order_date: new Date().toISOString().slice(0, 10),
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const onPickProduct = (id) => {
    const p = byId[id]
    set('product_id', id)
    if (p && (form.selling_price === '' || form.selling_price == null)) {
      set('selling_price', p.default_selling_price ?? '')
    }
  }

  // Stock preview for the chosen product (expand bundle to components).
  const stockNote = useMemo(() => {
    const p = byId[form.product_id]
    if (!p) return null
    const comps = p.type === 'bundle' ? p.components : [{ productId: p.id, qty: 1 }]
    return comps.map((c) => {
      const comp = byId[c.productId]
      if (!comp) return null
      return `${comp.name}: ${remainingStock(comp)} left`
    }).filter(Boolean).join(' · ')
  }, [form.product_id, byId])

  const submit = async (e) => {
    e.preventDefault()
    setErr(''); setOk('')
    const p = byId[form.product_id]
    if (!p) { setErr('Pick a product.'); return }
    setBusy(true)
    try {
      const { order_no } = await createOrderWithStock(
        {
          customer_name: form.customer_name.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          platform: form.platform,
          product_id: form.product_id,
          quantity: Number(form.quantity) || 1,
          selling_price: Number(form.selling_price) || 0,
          cost_price_snapshot: Number(p.cost_price) || 0,
          payment_method: form.payment_method,
          status: form.status,
          notes: form.notes.trim(),
          order_date: form.order_date,
        },
        p
      )
      setOk(`Saved ${order_no}. Stock updated.`)
      setForm((f) => ({
        ...f, customer_name: '', phone: '', address: '', notes: '',
        product_id: '', selling_price: '', quantity: 1,
      }))
      setTimeout(() => navigate('/orders'), 900)
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <h1>New order</h1>
      <form onSubmit={submit}>
        <div className="card">
          <label>Customer name</label>
          <input value={form.customer_name} onChange={(e) => set('customer_name', e.target.value)} required />
          <div className="row">
            <div>
              <label>Phone</label>
              <input value={form.phone} onChange={(e) => set('phone', e.target.value)} inputMode="tel" />
            </div>
            <div>
              <label>Order date</label>
              <input type="date" value={form.order_date} onChange={(e) => set('order_date', e.target.value)} />
            </div>
          </div>
          <label>Address</label>
          <textarea value={form.address} onChange={(e) => set('address', e.target.value)} />
          <label>Platform</label>
          <select value={form.platform} onChange={(e) => set('platform', e.target.value)} required>
            <option value="">Select…</option>
            {settings.platforms.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div className="card">
          <label>Product</label>
          <select value={form.product_id} onChange={(e) => onPickProduct(e.target.value)} required>
            <option value="">Select…</option>
            {sellable.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}{p.type === 'bundle' ? ' (bundle)' : ''}
              </option>
            ))}
          </select>
          {stockNote && <p className="small muted" style={{ marginTop: 6 }}>{stockNote}</p>}
          <div className="row">
            <div>
              <label>Quantity</label>
              <input type="number" min="1" value={form.quantity}
                onChange={(e) => set('quantity', e.target.value)} inputMode="numeric" />
            </div>
            <div>
              <label>Selling price (Rs)</label>
              <input type="number" min="0" value={form.selling_price}
                onChange={(e) => set('selling_price', e.target.value)} inputMode="decimal" required />
            </div>
          </div>
          <label>Payment method</label>
          <select value={form.payment_method} onChange={(e) => set('payment_method', e.target.value)}>
            {settings.payment_methods.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <label>Status</label>
          <select value={form.status} onChange={(e) => set('status', e.target.value)}>
            {settings.statuses.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <label>Notes</label>
          <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>

        {err && <div className="banner error">{err}</div>}
        {ok && <div className="banner success">{ok}</div>}
        <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save order & deduct stock'}</button>
      </form>
    </div>
  )
}
