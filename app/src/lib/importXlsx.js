import * as XLSX from 'xlsx'

// ---------- Milestone 1: parse a workbook and report its structure ----------

// Excel serial date -> JS Date (Excel epoch 1899-12-30).
export function excelSerialToDate(serial) {
  if (typeof serial !== 'number' || !isFinite(serial)) return null
  const ms = Math.round((serial - 25569) * 86400 * 1000)
  const d = new Date(ms)
  return isNaN(d.getTime()) ? null : d
}

function toISODate(v) {
  if (v == null || v === '') return null
  if (typeof v === 'number') {
    const d = excelSerialToDate(v)
    return d ? d.toISOString().slice(0, 10) : null
  }
  // Try to salvage a text date; reject impossible ones like "2026-08-320".
  const s = String(v).trim()
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

// A row of header labels often sits below a title/subtitle. Find the row that
// looks most like a header (max non-empty string cells) within the first N rows.
function detectHeaderRow(rows, maxScan = 8) {
  let best = { index: 0, score: -1 }
  for (let i = 0; i < Math.min(rows.length, maxScan); i++) {
    const cells = rows[i] || []
    const score = cells.filter(
      (c) => typeof c === 'string' && c.trim() !== ''
    ).length
    if (score > best.score) best = { index: i, score }
  }
  return best.index
}

/**
 * Parse an ArrayBuffer/File-read buffer into a structural report.
 * Returns { fileName, sheets: [{ name, hidden, headerRowIndex, fields, rowCount, preview }] }
 * This performs NO writes and is safe to show before any import.
 */
export function parseWorkbookReport(arrayBuffer, fileName = '') {
  const wb = XLSX.read(arrayBuffer, { type: 'array' })
  const sheets = wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false })
    const headerRowIndex = detectHeaderRow(rows)
    const headerCells = rows[headerRowIndex] || []
    const fields = headerCells
      .map((c) => (c == null ? '' : String(c).trim()))
      .filter((c) => c !== '')
    const dataRows = rows.slice(headerRowIndex + 1)
    const preview = dataRows.slice(0, 5)
    // sheet visibility, if present in workbook metadata
    const sheetMeta = (wb.Workbook?.Sheets || []).find((s) => s.name === name)
    const hidden = sheetMeta ? Number(sheetMeta.Hidden) > 0 : false
    return {
      name,
      hidden,
      headerRowIndex,
      fields,
      rowCount: dataRows.filter((r) => r.some((c) => String(c).trim() !== '')).length,
      preview,
    }
  })
  return { fileName, sheetCount: sheets.length, sheets }
}

// ---------- Milestone 2: map recognized sheets into normalized records ----------

// Read a sheet as array-of-objects keyed by its detected header row.
function sheetObjects(wb, name) {
  const ws = wb.Sheets[name]
  if (!ws) return []
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false })
  const h = detectHeaderRow(rows)
  const headers = (rows[h] || []).map((c) => String(c).trim())
  const out = []
  for (let i = h + 1; i < rows.length; i++) {
    const r = rows[i]
    if (!r || !r.some((c) => String(c).trim() !== '')) continue
    const obj = {}
    headers.forEach((key, idx) => {
      if (key) obj[key] = r[idx]
    })
    out.push(obj)
  }
  return out
}

const clean = (v) => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim())

// Phones stored as scientific notation (9.818156042E9) or with noise.
export function normalizePhone(v) {
  if (v == null || v === '') return ''
  if (typeof v === 'number') {
    // Avoid scientific notation; keep as integer string.
    return String(Math.round(v))
  }
  const s = String(v).trim()
  // Placeholder like 98XXXXXXXX — keep as-is so user can see it needs fixing.
  return s
}

const yes = (v) => clean(v).toLowerCase() === 'yes'

// Derive the bundle/product name from the Yes/No component flags.
function productFromFlags(shampoo, foamx, towel) {
  if (shampoo && foamx && towel) return 'Clean Wash Combo'
  if (shampoo && foamx) return 'Wash Combo'
  if (shampoo && towel) return 'Shampoo + Towel'
  if (foamx && towel) return 'FoamX + Towel'
  if (shampoo) return 'Car Shampoo'
  if (foamx) return 'FoamX'
  if (towel) return 'Towel'
  return ''
}

const num = (v) => {
  const n = Number(String(v).replace(/[^0-9.\-]/g, ''))
  return isFinite(n) ? n : 0
}

/**
 * Given a parsed workbook, produce normalized records + warnings for review.
 * Does NOT write to Firestore — the caller commits after showing the dry run.
 */
export function buildImportPlan(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' })
  const warnings = []
  const has = (n) => wb.SheetNames.includes(n)

  // --- Orders ---
  const orders = []
  const customersMap = new Map()
  let maxOrderNo = 1000
  if (has('Orders')) {
    for (const row of sheetObjects(wb, 'Orders')) {
      const orderId = clean(row['Order ID'])
      if (!orderId) continue
      const shampoo = yes(row['Shampoo?'])
      const foamx = yes(row['FoamX?'])
      const towel = yes(row['Towel?'])
      const productName = clean(row['Product']) || productFromFlags(shampoo, foamx, towel)
      const date = toISODate(row['Order Date'])
      if (!date) warnings.push(`Order ${orderId}: unreadable date "${row['Order Date']}"`)

      // The Address cell is sometimes actually a phone number.
      let address = clean(row['Address'])
      let phone = normalizePhone(row['Phone No'])
      if (/^\d[\d.eE+]{6,}$/.test(address.replace(/\s/g, '')) && !phone) {
        phone = normalizePhone(address)
        address = ''
        warnings.push(`Order ${orderId}: address looked like a phone number; moved to phone`)
      }

      const m = orderId.match(/(\d+)/)
      if (m) maxOrderNo = Math.max(maxOrderNo, Number(m[1]))

      const name = clean(row['Name'])
      if (name) {
        const key = name.toLowerCase()
        if (!customersMap.has(key)) {
          customersMap.set(key, { name, phone, address })
        }
      }

      orders.push({
        order_no: orderId,
        order_date: date,
        customer_name: name,
        phone,
        address,
        platform: clean(row['Platform']),
        product_name: productName,
        flags: { shampoo, foamx, towel },
        quantity: num(row['Quantity']) || 1,
        selling_price: num(row['Selling Price']),
        payment_method: clean(row['Payment Method']) || 'COD',
        status: clean(row['Delivery Status']) || 'Pending',
        notes: clean(row['Notes']),
      })
    }
  }

  // --- Inventory (component products) ---
  const products = []
  if (has('Inventory')) {
    for (const row of sheetObjects(wb, 'Inventory')) {
      const name = clean(row['Product'])
      if (!name) continue
      products.push({
        name,
        sku: clean(row['SKU']),
        category: clean(row['Category']) || 'Car Care',
        type: 'component',
        opening_stock: num(row['Opening Stock']),
        restocked_qty: num(row['Restocked Qty']),
        reorder_level: num(row['Reorder Level']),
        cost_price: 0, // back-filled from Sales below
        default_selling_price: 0,
      })
    }
  }

  // --- Sales: back-fill cost prices per product name ---
  const costByProduct = {}
  const sellByProduct = {}
  if (has('Sales')) {
    for (const row of sheetObjects(wb, 'Sales')) {
      const prod = clean(row['Product'])
      if (!prod) continue
      const cost = num(row['Cost Price'])
      const sell = num(row['Selling Price'])
      if (cost) costByProduct[prod] = cost
      if (sell) sellByProduct[prod] = sell
    }
  }

  // --- Expenses ---
  const expenses = []
  if (has('Expenses')) {
    for (const row of sheetObjects(wb, 'Expenses')) {
      const desc = clean(row['Description'])
      const amount = num(row['Amount'])
      if (!desc && !amount) continue
      const date = toISODate(row['Date'])
      if (!date) warnings.push(`Expense "${desc}": bad date "${row['Date']}" — needs manual fix`)
      expenses.push({
        date: date || null,
        category: clean(row['Category']) || 'Other',
        description: desc,
        amount,
        payment_method: clean(row['Payment Method']) || 'Cash',
        needsReview: !date,
      })
    }
  }

  // --- Ad Spend ---
  const adSpend = []
  if (has('Ad Spend')) {
    for (const row of sheetObjects(wb, 'Ad Spend')) {
      const amount = num(row['Amount'])
      const platform = clean(row['Platform'])
      if (!amount && !platform) continue
      adSpend.push({
        date: toISODate(row['Date']),
        platform,
        campaign: clean(row['Campaign']),
        amount,
        notes: clean(row['Notes/Objective'] || row['Notes']),
      })
    }
  }

  // --- Lists -> settings ---
  let settings = null
  if (has('Lists')) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets['Lists'], { header: 1, defval: '' })
    const col = (idx) =>
      rows.slice(1).map((r) => clean(r[idx])).filter(Boolean)
    settings = {
      platforms: col(0),
      payment_methods: col(1),
      statuses: col(2),
      expense_categories: col(3),
      ad_platforms: col(4),
    }
  }

  return {
    counts: {
      orders: orders.length,
      customers: customersMap.size,
      products: products.length,
      expenses: expenses.length,
      adSpend: adSpend.length,
      hasSettings: !!settings,
    },
    maxOrderNo,
    orders,
    customers: Array.from(customersMap.values()),
    products,
    costByProduct,
    sellByProduct,
    expenses,
    adSpend,
    settings,
    warnings,
  }
}
