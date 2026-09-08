import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useCollection } from '../lib/useCollection'
import { formatNPR } from '../lib/calc'

export default function Invoice() {
  const { orderId } = useParams()
  const { data: orders } = useCollection('orders')
  const [picked, setPicked] = useState(orderId || '')

  const sorted = useMemo(
    () => [...orders].sort((a, b) =>
      (b.order_no || '').localeCompare(a.order_no || '', undefined, { numeric: true })),
    [orders]
  )
  const order = useMemo(
    () => orders.find((o) => o.id === picked) || orders.find((o) => o.order_no === picked),
    [orders, picked]
  )

  const total = order ? (Number(order.selling_price) || 0) * (Number(order.quantity) || 1) : 0

  return (
    <div className="page">
      <h1 className="no-print">Invoice</h1>

      <div className="card no-print">
        <label>Pick an order</label>
        <select value={picked} onChange={(e) => setPicked(e.target.value)}>
          <option value="">Select…</option>
          {sorted.map((o) => (
            <option key={o.id} value={o.id}>{o.order_no} · {o.customer_name}</option>
          ))}
        </select>
      </div>

      {order && (
        <>
          <div className="card invoice-print" style={{ background: '#fff', color: '#000' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: '2px solid #000', paddingBottom: 12 }}>
              <img src="/logo.png" alt="MotoviaNepal" style={{ height: 46, background: '#000', borderRadius: 8, padding: 4 }} />
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.2rem' }}>MotoviaNepal</div>
                <div style={{ fontSize: '0.8rem', color: '#555' }}>Premium Auto Care</div>
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <div style={{ fontWeight: 700 }}>INVOICE</div>
                <div className="mono" style={{ fontSize: '0.85rem' }}>{order.order_no}</div>
                <div style={{ fontSize: '0.8rem', color: '#555' }}>{order.order_date}</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, fontSize: '0.9rem' }}>
              <div>
                <div style={{ color: '#777', fontSize: '0.75rem' }}>BILL TO</div>
                <div style={{ fontWeight: 700 }}>{order.customer_name}</div>
                {order.phone && <div>{order.phone}</div>}
                {order.address && <div style={{ maxWidth: 220 }}>{order.address}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#777', fontSize: '0.75rem' }}>PLATFORM</div>
                <div>{order.platform}</div>
                <div style={{ color: '#777', fontSize: '0.75rem', marginTop: 6 }}>PAYMENT</div>
                <div>{order.payment_method}</div>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16, fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>
                  <th style={{ padding: '8px 4px' }}>Item</th>
                  <th style={{ padding: '8px 4px', textAlign: 'center' }}>Qty</th>
                  <th style={{ padding: '8px 4px', textAlign: 'right' }}>Price</th>
                  <th style={{ padding: '8px 4px', textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '8px 4px' }}>{order.product_name}</td>
                  <td style={{ padding: '8px 4px', textAlign: 'center' }}>{order.quantity}</td>
                  <td style={{ padding: '8px 4px', textAlign: 'right' }}>{formatNPR(order.selling_price)}</td>
                  <td style={{ padding: '8px 4px', textAlign: 'right' }}>{formatNPR(total)}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} style={{ padding: '10px 4px', textAlign: 'right', fontWeight: 700 }}>Total</td>
                  <td style={{ padding: '10px 4px', textAlign: 'right', fontWeight: 800, fontSize: '1.05rem' }}>{formatNPR(total)}</td>
                </tr>
              </tfoot>
            </table>

            <div style={{ marginTop: 14, fontSize: '0.85rem', color: '#555' }}>
              Status: <strong style={{ color: '#000' }}>{order.status}</strong>
              {order.notes && <div style={{ marginTop: 6 }}>Note: {order.notes}</div>}
            </div>
            <div style={{ marginTop: 18, textAlign: 'center', fontSize: '0.8rem', color: '#777' }}>
              Thank you for choosing MotoviaNepal 🚗
            </div>
          </div>

          <button className="btn no-print" onClick={() => window.print()}>🖨 Print / Save PDF</button>
        </>
      )}
    </div>
  )
}
