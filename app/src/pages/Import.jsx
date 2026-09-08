import { useState } from 'react'
import { parseWorkbookReport, buildImportPlan } from '../lib/importXlsx'
import { commitImportPlan } from '../lib/commitImport'

export default function Import() {
  const [fileName, setFileName] = useState('')
  const [buffer, setBuffer] = useState(null)
  const [report, setReport] = useState(null)   // Milestone 1: field names
  const [plan, setPlan] = useState(null)        // Milestone 2: dry run
  const [result, setResult] = useState(null)    // commit summary
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setErr(''); setReport(null); setPlan(null); setResult(null)
    try {
      const buf = await file.arrayBuffer()
      setBuffer(buf)
      setFileName(file.name)
      setReport(parseWorkbookReport(buf, file.name))
    } catch (e) {
      setErr('Could not read that file. Is it a valid .xlsx?')
    }
  }

  const buildPlan = () => {
    setErr('')
    try {
      setPlan(buildImportPlan(buffer))
    } catch (e) {
      setErr(e.message)
    }
  }

  const commit = async () => {
    if (!plan) return
    setBusy(true); setErr('')
    try {
      const summary = await commitImportPlan(plan, fileName)
      setResult(summary)
    } catch (e) {
      setErr('Import failed: ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <h1>Import from spreadsheet</h1>
      <p className="muted small">
        Upload your <span className="mono">Advanced Business Tracker</span> (.xlsx). First you’ll see
        the detected sheets and field names. Nothing is saved until you confirm.
      </p>

      <div className="card">
        <label>Choose .xlsx file</label>
        <input type="file" accept=".xlsx,.xls" onChange={onFile} />
        {fileName && <p className="small muted" style={{ marginTop: 8 }}>Loaded: {fileName}</p>}
      </div>

      {err && <div className="banner error">{err}</div>}

      {/* Milestone 1 — detected structure */}
      {report && (
        <>
          <h2>Detected {report.sheetCount} sheets</h2>
          {report.sheets.map((s) => (
            <div className="card" key={s.name}>
              <div className="list-item" style={{ paddingTop: 0 }}>
                <div className="grow">
                  <div className="title">
                    {s.name} {s.hidden && <span className="badge Cancelled">hidden</span>}
                  </div>
                  <div className="sub">{s.fields.length} fields · {s.rowCount} data rows</div>
                </div>
              </div>
              {s.fields.length > 0 && (
                <div className="field-chips">
                  {s.fields.map((f, i) => (
                    <span className="chip" key={i}><span className="num">{i + 1}</span>{f}</span>
                  ))}
                </div>
              )}
              {s.preview.length > 0 && (
                <div className="tbl-wrap" style={{ marginTop: 10 }}>
                  <table className="data">
                    <thead>
                      <tr>{s.fields.map((f, i) => <th key={i}>{f}</th>)}</tr>
                    </thead>
                    <tbody>
                      {s.preview.map((row, ri) => (
                        <tr key={ri}>
                          {s.fields.map((_, ci) => (
                            <td key={ci}>{String(row[ci] ?? '')}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}

          {!plan && !result && (
            <button className="btn" onClick={buildPlan}>Continue → preview import</button>
          )}
        </>
      )}

      {/* Milestone 2 — dry run */}
      {plan && !result && (
        <>
          <h2>Import preview (dry run)</h2>
          <div className="card">
            <div className="grid2">
              <Stat label="Orders" v={plan.counts.orders} />
              <Stat label="Customers" v={plan.counts.customers} />
              <Stat label="Products" v={plan.counts.products} />
              <Stat label="Expenses" v={plan.counts.expenses} />
              <Stat label="Ad spend rows" v={plan.counts.adSpend} />
              <Stat label="Dropdown lists" v={plan.counts.hasSettings ? 'Yes' : 'No'} />
            </div>
            <p className="small muted" style={{ marginTop: 10 }}>
              Highest order number: ORD-{plan.maxOrderNo}. Bundles (Wash Combo, Clean Wash Combo)
              will be created and linked to components automatically.
            </p>
          </div>

          {plan.warnings.length > 0 && (
            <div className="banner warn">
              <strong>{plan.warnings.length} rows need a look:</strong>
              <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                {plan.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          <div className="banner info">
            Re-importing is safe: orders whose ID already exists are skipped, so nothing duplicates.
          </div>

          <button className="btn" onClick={commit} disabled={busy}>
            {busy ? 'Importing…' : 'Import into database'}
          </button>
        </>
      )}

      {/* Result */}
      {result && (
        <>
          <h2>Import complete</h2>
          <div className="banner success">
            Imported {result.orders} orders ({result.ordersSkipped} skipped as duplicates),
            {' '}{result.products} products + {result.bundles} bundles, {result.customers} customers,
            {' '}{result.expenses} expenses, {result.adSpend} ad-spend rows
            {result.settings ? ', and your dropdown lists.' : '.'}
          </div>
          <p className="small muted">Stock counts were recalculated from the imported orders.</p>
        </>
      )}
    </div>
  )
}

function Stat({ label, v }) {
  return (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className="value">{v}</div>
    </div>
  )
}
