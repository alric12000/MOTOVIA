import { useState } from 'react';
import { writeBatch, doc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { seedAdSpend, seedCustomers, seedExpenses, seedProducts, seedSales } from '../data/seedData';
import { Database, Upload, CheckCircle2, AlertCircle } from 'lucide-react';

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function deriveCustomersFromSales() {
  const customerMap = new Map<string, { name: string; totalOrders: number; totalSpent: number; platform: string; lastOrderDate: string }>();

  seedSales.forEach((sale) => {
    const key = sale.customerName.toLowerCase();
    const existing = customerMap.get(key);

    if (!existing) {
      customerMap.set(key, {
        name: sale.customerName,
        totalOrders: 1,
        totalSpent: sale.revenue,
        platform: sale.platform || 'Unknown',
        lastOrderDate: sale.date,
      });
      return;
    }

    existing.totalOrders += 1;
    existing.totalSpent += sale.revenue;
    if (sale.date > existing.lastOrderDate) {
      existing.lastOrderDate = sale.date;
    }
  });

  return Array.from(customerMap.values()).map((customer) => ({
    id: `cust-${slugify(customer.name)}`,
    customerId: `CUST-${slugify(customer.name).slice(0, 12).toUpperCase()}`,
    name: customer.name,
    phone: '',
    address: '',
    platform: customer.platform,
    totalOrders: customer.totalOrders,
    totalSpent: customer.totalSpent,
    lastOrderDate: customer.lastOrderDate,
  }));
}

export function DataImportPage() {
  const [status, setStatus] = useState<'idle' | 'working' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleImport = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setStatus('error');
      setMessage('You need to sign in before importing data.');
      return;
    }

    setStatus('working');
    setMessage('Writing products, sales, expenses, ad spend, and customers to Firestore...');

    try {
      const batch = writeBatch(db);

      seedProducts.forEach((product) => {
        batch.set(doc(db, 'products', product.id), product, { merge: true });
      });

      seedSales.forEach((sale) => {
        batch.set(doc(db, 'sales', sale.orderId), sale, { merge: true });
      });

      seedExpenses.forEach((expense) => {
        batch.set(doc(db, 'expenses', expense.id), expense, { merge: true });
      });

      seedAdSpend.forEach((adSpend) => {
        batch.set(doc(db, 'ad_spend', adSpend.id), adSpend, { merge: true });
      });

      [...deriveCustomersFromSales(), ...seedCustomers].forEach((customer) => {
        batch.set(doc(db, 'customers', customer.id), customer, { merge: true });
      });

      await batch.commit();

      setStatus('success');
      setMessage(
        `Imported ${seedProducts.length} products, ${seedSales.length} sales, ${seedExpenses.length} expenses, ${seedAdSpend.length} ad spend entries, and ${deriveCustomersFromSales().length + seedCustomers.length} customer records.`
      );
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Failed to import data.');
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-8">
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-rose-500">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-serif italic text-white">Data Import</h1>
            <p className="text-xs text-white/40 tracking-wide uppercase mt-1">Bulk upsert existing sheet data into Firestore</p>
          </div>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <div className="text-[10px] uppercase tracking-widest text-white/40 mb-3">Ready to import</div>
          <div className="space-y-2 text-sm text-white/70">
            <div>Products: {seedProducts.length}</div>
            <div>Sales: {seedSales.length}</div>
            <div>Expenses: {seedExpenses.length}</div>
            <div>Ad spend: {seedAdSpend.length}</div>
            <div>Customers: {deriveCustomersFromSales().length + seedCustomers.length}</div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <div className="text-[10px] uppercase tracking-widest text-white/40 mb-3">How it works</div>
          <p className="text-sm text-white/70 leading-6">
            This page writes deterministic document IDs so you can update the same Firebase records again without creating duplicates.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
        <button
          onClick={handleImport}
          disabled={status === 'working'}
          className="inline-flex items-center gap-3 rounded-lg bg-rose-600 px-5 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-rose-700 disabled:opacity-60"
        >
          <Upload className="h-4 w-4" />
          {status === 'working' ? 'Importing...' : 'Import Existing Data'}
        </button>

        {message && (
          <div
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${status === 'success'
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                : status === 'error'
                  ? 'border-rose-500/20 bg-rose-500/10 text-rose-300'
                  : 'border-white/10 bg-white/5 text-white/70'
              }`}
          >
            {status === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>{message}</span>
          </div>
        )}
      </div>
    </div>
  );
}
