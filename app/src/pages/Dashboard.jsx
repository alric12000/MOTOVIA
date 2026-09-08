import { useMemo, useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  Legend, PieChart, Pie, Cell,
} from 'recharts'
import { useCollection } from '../lib/useCollection'
import {
  summarize, monthlySeries, breakdownBy, formatNPR, isSellingOrder, remainingStock, isLowStock,
} from '../lib/calc'

const COLORS = ['#2196f3', '#4ade80', '#f59e0b', '#f87171', '#a78bfa', '#22d3ee', '#fb923c']

export default function Dashboard() {
  const { data: orders } = useCollection('orders')
  const { data: expenses } = useCollection('expenses')
  const { data: adSpend } = useCollection('ad_spend')
  const { data: products } = useCollection('products')

  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const inRange = (d) => (!from || (d && d >= from)) && (!to || (d && d <= to))
  const fOrders = useMemo(() => orders.filter((o) => inRange(o.order_date)), [orders, from, to])
  const fExp = useMemo(() => expenses.filter((e) => inRange(e.date)), [expenses, from, to])
  const fAds = useMemo(() => adSpend.filter((a) => inRange(a.date)), [adSpend, from, to])

  const k = useMemo(() => summarize(fOrders, fExp, fAds), [fOrders, fExp, fAds])
  const lowCount = useMemo(
    () => products.filter((p) => p.type === 'component' && isLowStock(p)).length,
    [products]
  )

  const year = useMemo(() => {
    if (to) return new Date(to).getFullYear()
    const dated = orders.filter((o) => o.order_date)
    return dated.length
      ? new Date(dated.map((o) => o.order_date).sort().at(-1)).getFullYear()
      : new Date().getFullYear()
  }, [orders, to])

  const months = useMemo(() => monthlySeries(fOrders, fExp, fAds, year), [fOrders, fExp, fAds, year])
  const byPlatform = useMemo(
    () => breakdownBy(fOrders.filter(isSellingOrder), (o) => o.platform), [fOrders])
  const byProduct = useMemo(
    () => breakdownBy(fOrders.filter(isSellingOrder), (o) => o.product_name), [fOrders])

  return (
    <div className="page">
      <h1>Dashboard</h1>

      <div className="card">
        <div className="row">
          <div>
            <label>From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label>To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        {(from || to) && (
          <button className="btn ghost sm" style={{ marginTop: 10 }}
            onClick={() => { setFrom(''); setTo('') }}>Clear range</button>
        )}
      </div>

      <div className="kpis">
        <Kpi label="Total Revenue" value={formatNPR(k.revenue)} />
        <Kpi label="COGS" value={formatNPR(k.cogs)} />
        <Kpi label="Gross Profit" value={formatNPR(k.grossProfit)} good={k.grossProfit >= 0} />
        <Kpi label="Expenses" value={formatNPR(k.totalExpenses)} />
        <Kpi label="Ad Spend" value={formatNPR(k.totalAdSpend)} />
        <Kpi label="Net Profit" value={formatNPR(k.netProfit)} good={k.netProfit >= 0} bad={k.netProfit < 0} />
        <Kpi label="Total Orders" value={k.totalOrders} />
        <Kpi label="Customers" value={k.totalCustomers} />
        <Kpi label="Low Stock Items" value={lowCount} bad={lowCount > 0} />
      </div>

      <h2>Monthly performance ({year})</h2>
      <div className="card">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={months} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#26262c" />
            <XAxis dataKey="month" stroke="#9aa0a6" fontSize={11} />
            <YAxis stroke="#9aa0a6" fontSize={11} />
            <Tooltip contentStyle={{ background: '#17171b', border: '1px solid #26262c', borderRadius: 8 }}
              formatter={(v) => formatNPR(v)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="revenue" name="Revenue" fill="#2196f3" radius={[3, 3, 0, 0]} />
            <Bar dataKey="expenses" name="Expenses" fill="#f59e0b" radius={[3, 3, 0, 0]} />
            <Bar dataKey="netProfit" name="Net Profit" fill="#4ade80" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid2">
        <div className="card">
          <h2 style={{ marginTop: 0 }}>By platform</h2>
          <Donut data={byPlatform} />
        </div>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>By product</h2>
          <Donut data={byProduct} />
        </div>
      </div>

      <h2>Revenue by platform</h2>
      <div className="card">
        {byPlatform.map((p, i) => (
          <div className="list-item" key={p.name}>
            <span className="ic" style={{ width: 12, height: 12, borderRadius: 3, background: COLORS[i % COLORS.length], display: 'inline-block' }} />
            <div className="grow title">{p.name}</div>
            <div className="right title">{formatNPR(p.value)}</div>
          </div>
        ))}
        {byPlatform.length === 0 && <p className="muted small">No data in range.</p>}
      </div>
    </div>
  )
}

function Kpi({ label, value, good, bad }) {
  return (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className={`value ${good ? 'good' : ''} ${bad ? 'bad' : ''}`}>{value}</div>
    </div>
  )
}

function Donut({ data }) {
  if (!data.length) return <p className="muted small">No data in range.</p>
  return (
    <ResponsiveContainer width="100%" height={180}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={2}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip contentStyle={{ background: '#17171b', border: '1px solid #26262c', borderRadius: 8 }}
          formatter={(v) => formatNPR(v)} />
      </PieChart>
    </ResponsiveContainer>
  )
}
