import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCollection, useDoc, indexById } from '../lib/useCollection'
import { createOrderWithStock } from '../lib/inventory'
import { DEFAULT_SETTINGS } from '../lib/constants'
import { remainingStock, formatNPR } from '../lib/calc'

export default function OrderEntry() {
  const navigate = useNavigate()
  const { data: products } = useCollection('products')
  const { data: settingsDoc } = useDoc('settings', 'config')
  const settings = settingsDoc || DEFAULT_SETTINGS

  const sellable = useMemo(
    () => products.filter((p) => p.active !== false).sort((a, b) => a.name.localeCompare(b.name)),
    [products]
  )
  const byId = useMemo(() => indexById(products), [products])

  const [form, setForm] = useState({
    customer_name: '', phone: '', address: '',
    platform: '',
    payment_method: 'COD', status: 'Pending', notes: '',
    order_date: new Date().toISOString().slice(0, 10),
  })

  // Support multiple items / extra products in a single order
  const [items, setItems] = useState([
    { product_id: '', quantity: 1, selling_price: '' }
  ])

  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')

  const setFormKey = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleItemChange = (index, field, val) => {
    setItems((prevItems) => {
      const updated = [...prevItems]
      const curItem = { ...updated[index], [field]: val }

      if (field === 'product_id') {
        const p = byId[val]
        if (p) {
          // Auto-populate SP when product is selected, while keeping it editable for discounts
          curItem.selling_price = p.default_selling_price ?? ''
        }
      }
      updated[index] = curItem
      return updated
    })
  }

  const addItemRow = () => {
    setItems((prev) => [...prev, { product_id: '', quantity: 1, selling_price: '' }])
  }

  const removeItemRow = (index) => {
    if (items.length <= 1) return
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const totalOrderAmount = useMemo(() => {
    return items.reduce((sum, it) => {
      const price = Number(it.selling_price) || 0
      const qty = Number(it.quantity) || 1
      return sum + (price * qty)
    }, 0)
  }, [items])

  const getItemStockNote = (productId) => {
    if (!productId) return null
    const p = byId[productId]
    if (!p) return null
    const comps = p.type === 'bundle' ? p.components : [{ productId: p.id, qty: 1 }]
    return comps.map((c) => {
      const comp = byId[c.productId]
      if (!comp) return null
      return `${comp.name}: ${remainingStock(comp)} left`
    }).filter(Boolean).join(' · ')
  }

  const submit = async (e) => {
    e.preventDefault()
    setErr(''); setOk('')

    // Validate items
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      if (!it.product_id) {
        setErr(`Please select a product for Item #${i + 1}.`)
        return
      }
      if (it.selling_price === '' || Number(it.selling_price) < 0) {
        setErr(`Please set a valid selling price for Item #${i + 1}.`)
        return
      }
    }

    setBusy(true)
    try {
      const formattedItems = items.map((it) => {
        const p = byId[it.product_id]
        return {
          product_id: it.product_id,
          product_name: p ? p.name : '',
          product_type: p ? p.type : 'component',
          quantity: Number(it.quantity) || 1,
          selling_price: Number(it.selling_price) || 0,
          cost_price_snapshot: Number(p?.cost_price) || 0,
        }
      })

      const { order_no } = await createOrderWithStock(
        {
          customer_name: form.customer_name.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          platform: form.platform,
          payment_method: form.payment_method,
          status: form.status,
          notes: form.notes.trim(),
          order_date: form.order_date,
          items: formattedItems,
        },
        byId
      )

      setOk(`Saved ${order_no}. Stock updated.`)
      setForm((f) => ({
        ...f, customer_name: '', phone: '', address: '', notes: '',
      }))
      setItems([{ product_id: '', quantity: 1, selling_price: '' }])
      setTimeout(() => navigate('/orders'), 900)
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <h1>New Order</h1>
      <form onSubmit={submit}>
        <div className="card">
          <label>Customer Name</label>
          <input value={form.customer_name} onChange={(e) => setFormKey('customer_name', e.target.value)} required />
          <div className="row">
            <div>
              <label>Phone</label>
              <input value={form.phone} onChange={(e) => setFormKey('phone', e.target.value)} inputMode="tel" />
            </div>
            <div>
              <label>Order Date</label>
              <input type="date" value={form.order_date} onChange={(e) => setFormKey('order_date', e.target.value)} />
            </div>
          </div>
          <label>Address / Location</label>
          <textarea value={form.address} onChange={(e) => setFormKey('address', e.target.value)} />
          <label>Platform</label>
          <select value={form.platform} onChange={(e) => setFormKey('platform', e.target.value)} required>
            <option value="">Select platform…</option>
            {settings.platforms.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text)' }}>Order Products & Extra Items</h2>
            {items.length > 1 && <span className="small muted">{items.length} items added</span>}
          </div>

          {items.map((it, idx) => {
            const stockNote = getItemStockNote(it.product_id)
            return (
              <div
                key={idx}
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 12,
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--accent)' }}>
                    Item #{idx + 1}
                  </span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      className="btn ghost sm"
                      style={{ padding: '2px 8px', fontSize: '0.75rem', color: 'var(--bad)' }}
                      onClick={() => removeItemRow(idx)}
                    >
                      ✕ Remove
                    </button>
                  )}
                </div>

                <label style={{ marginTop: 0 }}>Product / Bundle</label>
                <select
                  value={it.product_id}
                  onChange={(e) => handleItemChange(idx, 'product_id', e.target.value)}
                  required
                >
                  <option value="">Select product…</option>
                  {sellable.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.type === 'bundle' ? ' (bundle)' : ''} — {formatNPR(p.default_selling_price || 0)}
                    </option>
                  ))}
                </select>
                {stockNote && <p className="small muted" style={{ marginTop: 4, marginBottom: 8 }}>{stockNote}</p>}

                <div className="row">
                  <div>
                    <label>Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={it.quantity}
                      onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                      inputMode="numeric"
                      required
                    />
                  </div>
                  <div>
                    <label>Selling Price (Rs)</label>
                    <input
                      type="number"
                      min="0"
                      value={it.selling_price}
                      onChange={(e) => handleItemChange(idx, 'selling_price', e.target.value)}
                      inputMode="decimal"
                      placeholder="e.g. 1859"
                      required
                    />
                  </div>
                </div>
              </div>
            )
          })}

          <button
            type="button"
            className="btn secondary"
            style={{ marginBottom: 12 }}
            onClick={addItemRow}
          >
            ➕ Add Extra Product / Item (e.g. Extra Shampoo)
          </button>

          <div
            style={{
              display: 'flex',
              justify: 'space-between',
              alignItems: 'center',
              padding: '10px 14px',
              background: 'var(--surface)',
              borderRadius: 8,
              border: '1px solid var(--border)',
            }}
          >
            <span style={{ fontWeight: 600 }}>Total Order Price:</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--good)' }}>
              {formatNPR(totalOrderAmount)}
            </span>
          </div>

          <label>Payment Method</label>
          <select value={form.payment_method} onChange={(e) => setFormKey('payment_method', e.target.value)}>
            {settings.payment_methods.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <label>Status</label>
          <select value={form.status} onChange={(e) => setFormKey('status', e.target.value)}>
            {settings.statuses.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <label>Notes</label>
          <textarea value={form.notes} onChange={(e) => setFormKey('notes', e.target.value)} placeholder="e.g. Includes extra shampoo add-on" />
        </div>

        {err && <div className="banner error">{err}</div>}
        {ok && <div className="banner success">{ok}</div>}
        <button className="btn" disabled={busy}>{busy ? 'Saving order…' : 'Save Order & Deduct Stock'}</button>
      </form>
    </div>
  )
}

