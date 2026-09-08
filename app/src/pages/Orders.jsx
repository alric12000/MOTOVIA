import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCollection, useDoc, indexById } from '../lib/useCollection'
import { changeOrderStatus } from '../lib/inventory'
import StatusButtons from '../components/StatusButtons'
import { DEFAULT_SETTINGS } from '../lib/constants'
import { formatNPR } from '../lib/calc'

export default function Orders() {
  const { data: orders } = useCollection('orders')
  const { data: products } = useCollection('products')
  const { data: settingsDoc } = useDoc('settings', 'config')
  const settings = settingsDoc || DEFAULT_SETTINGS
  const byId = useMemo(() => indexById(products), [products])

  const [fStatus, setFStatus] = useState('')
  const [fPlatform, setFPlatform] = useState('')
  const [fFrom, setFFrom] = useState('')
  const [fTo, setFTo] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [err, setErr] = useState('')

  const filtered = useMemo(() => {
    return orders
      .filter((o) => !fStatus || o.status === fStatus)
      .filter((o) => !fPlatform || o.platform === fPlatform)
      .filter((o) => !fFrom || (o.order_date && o.order_date >= fFrom))
      .filter((o) => !fTo || (o.order_date && o.order_date <= fTo))
      .sort((a, b) => (b.order_no || '').localeCompare(a.order_no || '', undefined, { numeric: true }))
  }, [orders, fStatus, fPlatform, fFrom, fTo])

  const doStatus = async (order, newStatus) => {
    if (order.status === newStatus) return
    setErr(''); setBusyId(order.id)
    try {
      const product = byId[order.product_id]
      await changeOrderStatus(order.id, newStatus, product)
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="page">
      <h1>Orders</h1>

      <div className="card">
        <div className="row">
          <div>
            <label>Status</label>
            <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
              <option value="">All</option>
              {settings.statuses.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label>Platform</label>
            <select value={fPlatform} onChange={(e) => setFPlatform(e.target.value)}>
              <option value="">All</option>
              {settings.platforms.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="row">
          <div>
            <label>From</label>
            <input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
          </div>
          <div>
            <label>To</label>
            <input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} />
          </div>
        </div>
      </div>

      {err && <div className="banner error">{err}</div>}
      <p className="small muted">{filtered.length} orders</p>

      {filtered.map((o) => (
        <div className="card" key={o.id}>
          <div className="list-item" style={{ paddingTop: 0, paddingBottom: 8 }}
            onClick={() => setExpanded(expanded === o.id ? null : o.id)}>
            <div className="grow">
              <div className="title">{o.customer_name || 'Unnamed'}</div>
              <div className="sub">
                <span className="mono">{o.order_no}</span> · {o.product_name} ×{o.quantity} · {o.platform}
              </div>
            </div>
            <div className="right">
              <div className="title">{formatNPR((o.selling_price || 0) * (o.quantity || 1))}</div>
              <span className={`badge ${o.status}`}>{o.status}</span>
            </div>
          </div>

          {expanded === o.id && (
            <>
              {o.phone && <div className="small">📞 {o.phone}</div>}
              {o.address && <div className="small muted">📍 {o.address}</div>}
              {o.notes && <div className="small muted">📝 {o.notes}</div>}
              <div className="small muted" style={{ marginTop: 6 }}>
                {o.order_date} · {o.payment_method}
              </div>
              <StatusButtons
                current={o.status}
                disabled={busyId === o.id}
                onChange={(s) => doStatus(o, s)}
              />
              <div style={{ marginTop: 10 }}>
                <Link className="btn secondary sm" to={`/invoice/${o.id}`}>View invoice</Link>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
