#!/bin/bash

cat << 'INNEREOF' > src/components/CustomersPage.tsx
import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Customer } from '../types';

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'sales'), (snapshot) => {
      // In this app, the customer list is derived from sales or maintained separately.
      // We will derive it from sales to calculate total spent and orders accurately if the "customers" collection doesn't auto-update.
      const custMap: Record<string, any> = {};
      
      snapshot.forEach(doc => {
        const sale = doc.data();
        const cname = sale.customerName;
        if (!cname) return;
        
        if (!custMap[cname]) {
          custMap[cname] = {
            id: cname,
            name: cname,
            totalOrders: 0,
            totalSpent: 0,
            platform: sale.platform || 'Unknown',
            lastOrderDate: sale.date,
          };
        }
        
        custMap[cname].totalOrders += 1;
        custMap[cname].totalSpent += sale.revenue;
        
        if (sale.date > custMap[cname].lastOrderDate) {
          custMap[cname].lastOrderDate = sale.date;
        }
      });
      
      setCustomers(Object.values(custMap));
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);

  return (
    <div className="space-y-6 p-4 md:p-8">
      <header className="mb-8">
        <h1 className="text-xl font-serif italic text-white">Customer Database</h1>
        <p className="text-xs text-white/40 tracking-wide uppercase mt-1">Order counts & lifetime spend</p>
      </header>
      
      <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden flex flex-col">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="bg-white/[0.03] text-[10px] uppercase tracking-widest font-bold text-slate-300 border-b border-white/5">
            <tr>
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Platform</th>
              <th className="px-6 py-4 text-right">Total Orders</th>
              <th className="px-6 py-4 text-right">Total Spent</th>
              <th className="px-6 py-4 text-right">Last Order Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.02]">
            {loading ? <tr><td colSpan={5} className="px-6 py-8 text-center text-white/40 text-xs">Loading...</td></tr> : 
             customers.map(c => (
              <tr key={c.id} className="hover:bg-white/[0.01]">
                <td className="px-6 py-4 text-white font-serif">{c.name}</td>
                <td className="px-6 py-4 text-white/60">{c.platform}</td>
                <td className="px-6 py-4 text-right font-mono text-white">{c.totalOrders}</td>
                <td className="px-6 py-4 text-right text-emerald-500 font-mono text-xs">NPR {c.totalSpent?.toFixed(2)}</td>
                <td className="px-6 py-4 text-right text-white/60 font-mono text-xs">{c.lastOrderDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
INNEREOF

cat << 'INNEREOF' > src/components/PnLPage.tsx
import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export function PnLPage() {
  const [loading, setLoading] = useState(true);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const salesSnap = await getDocs(collection(db, 'sales'));
        const expSnap = await getDocs(collection(db, 'expenses'));
        const adSnap = await getDocs(collection(db, 'ad_spend'));
        
        const data: Record<string, any> = {};
        
        // Initialize months
        const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
        const currentYear = new Date().getFullYear().toString();
        
        months.forEach(m => {
          data[`${currentYear}-${m}`] = { month: m, revenue: 0, cogs: 0, expenses: 0, adSpend: 0 };
        });

        salesSnap.forEach(doc => {
          const s = doc.data();
          if (!s.date) return;
          const monthKey = s.date.substring(0, 7);
          if (data[monthKey]) {
            data[monthKey].revenue += s.revenue || 0;
            data[monthKey].cogs += s.cost || 0;
          }
        });

        expSnap.forEach(doc => {
          const e = doc.data();
          if (!e.date) return;
          const monthKey = e.date.substring(0, 7);
          if (data[monthKey]) {
            data[monthKey].expenses += e.amount || 0;
          }
        });

        adSnap.forEach(doc => {
          const a = doc.data();
          if (!a.date) return;
          const monthKey = a.date.substring(0, 7);
          if (data[monthKey]) {
            data[monthKey].adSpend += a.amount || 0;
          }
        });
        
        setMonthlyData(Object.keys(data).sort().map(k => ({ key: k, ...data[k] })));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="space-y-6 p-4 md:p-8">
      <header className="mb-8">
        <h1 className="text-xl font-serif italic text-white">Profit & Loss Statement</h1>
        <p className="text-xs text-white/40 tracking-wide uppercase mt-1">Monthly Summary</p>
      </header>
      
      <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden flex flex-col">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="bg-white/[0.03] text-[10px] uppercase tracking-widest font-bold text-slate-300 border-b border-white/5">
            <tr>
              <th className="px-6 py-4">Month</th>
              <th className="px-6 py-4 text-right">Revenue</th>
              <th className="px-6 py-4 text-right">COGS</th>
              <th className="px-6 py-4 text-right">Gross Profit</th>
              <th className="px-6 py-4 text-right">Expenses</th>
              <th className="px-6 py-4 text-right">Ad Spend</th>
              <th className="px-6 py-4 text-right text-emerald-500">Net Profit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.02]">
            {loading ? <tr><td colSpan={7} className="px-6 py-8 text-center text-white/40 text-xs">Loading...</td></tr> : 
             monthlyData.map(d => {
               const gp = d.revenue - d.cogs;
               const np = gp - d.expenses - d.adSpend;
               const monthName = new Date(`${d.key}-01`).toLocaleString('default', { month: 'long' });
               return (
                <tr key={d.key} className="hover:bg-white/[0.01]">
                  <td className="px-6 py-4 text-white font-serif">{monthName}</td>
                  <td className="px-6 py-4 text-right text-white font-mono text-xs">{d.revenue > 0 ? `NPR ${d.revenue.toFixed(2)}` : '-'}</td>
                  <td className="px-6 py-4 text-right text-rose-500 font-mono text-xs">{d.cogs > 0 ? `NPR ${d.cogs.toFixed(2)}` : '-'}</td>
                  <td className="px-6 py-4 text-right text-emerald-500 font-mono text-xs">{gp > 0 ? `NPR ${gp.toFixed(2)}` : '-'}</td>
                  <td className="px-6 py-4 text-right text-amber-500 font-mono text-xs">{d.expenses > 0 ? `NPR ${d.expenses.toFixed(2)}` : '-'}</td>
                  <td className="px-6 py-4 text-right text-amber-500 font-mono text-xs">{d.adSpend > 0 ? `NPR ${d.adSpend.toFixed(2)}` : '-'}</td>
                  <td className="px-6 py-4 text-right text-emerald-500 font-bold font-mono text-xs">{np !== 0 ? `NPR ${np.toFixed(2)}` : '-'}</td>
                </tr>
               )
             })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
INNEREOF

cat << 'INNEREOF' > src/components/InvoicePage.tsx
import { useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export function InvoicePage() {
  const [orderId, setOrderId] = useState('');
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchInvoice = async () => {
    if (!orderId) return;
    setLoading(true);
    setError('');
    setInvoice(null);
    try {
      const q = query(collection(db, 'sales'), where('orderId', '==', orderId));
      const snap = await getDocs(q);
      if (snap.empty) {
        setError('Invoice not found for this Order ID.');
      } else {
        setInvoice(snap.docs[0].data());
      }
    } catch (e) {
      setError('Error fetching invoice.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-8">
      <header className="mb-8">
        <h1 className="text-xl font-serif italic text-white">Invoice Generator</h1>
        <p className="text-xs text-white/40 tracking-wide uppercase mt-1">Type an Order ID below to auto-generate</p>
      </header>
      
      <div className="flex gap-4 items-center">
        <input 
          type="text" 
          placeholder="e.g. ORD-1001" 
          value={orderId} 
          onChange={e => setOrderId(e.target.value)} 
          className="px-4 py-2 bg-black/40 border border-white/10 rounded text-white text-sm"
        />
        <button 
          onClick={fetchInvoice} 
          disabled={loading || !orderId}
          className="px-5 py-2 bg-white text-black text-xs font-bold uppercase tracking-widest rounded disabled:opacity-50"
        >
          {loading ? 'Searching...' : 'Generate'}
        </button>
      </div>
      
      {error && <div className="text-rose-500 text-sm mt-4">{error}</div>}

      {invoice && (
        <div className="bg-white p-8 rounded-xl max-w-2xl mt-8 text-black shadow-2xl">
          <div className="flex justify-between items-start border-b border-gray-200 pb-8 mb-8">
            <div>
              <h2 className="text-3xl font-serif italic text-blue-900 font-bold mb-1">Invoice</h2>
              <div className="text-gray-500 font-mono text-sm">#{invoice.orderId}</div>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-gray-800">Motovia Nepal</div>
              <div className="text-gray-500 text-sm">Premium Auto Care</div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <div className="text-xs uppercase tracking-widest text-gray-400 font-bold mb-2">Billed To</div>
              <div className="text-lg font-serif">{invoice.customerName}</div>
              <div className="text-gray-600 text-sm">Platform: {invoice.platform || 'Other'}</div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-widest text-gray-400 font-bold mb-2">Order Date</div>
              <div className="text-lg font-mono">{invoice.date}</div>
              <div className="text-gray-600 text-sm">Status: {invoice.deliveryStatus}</div>
            </div>
          </div>
          
          <table className="w-full text-left mb-8 border-collapse">
            <thead className="bg-blue-900 text-white text-xs uppercase tracking-widest font-bold">
              <tr>
                <th className="px-4 py-3 rounded-tl-lg">Product</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-right">Unit Price</th>
                <th className="px-4 py-3 text-right rounded-tr-lg">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="px-4 py-4 font-serif">{invoice.productName || 'Unknown Product'}</td>
                <td className="px-4 py-4 text-right font-mono">{invoice.quantity}</td>
                <td className="px-4 py-4 text-right font-mono">NPR {invoice.sellingPrice?.toFixed(2) || (invoice.revenue / invoice.quantity).toFixed(2)}</td>
                <td className="px-4 py-4 text-right font-mono font-bold">NPR {invoice.revenue?.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
          
          <div className="flex justify-between items-end border-t border-gray-200 pt-8">
            <div>
              <div className="text-xs uppercase tracking-widest text-gray-400 font-bold mb-1">Payment Method</div>
              <div className="text-gray-800">{invoice.paymentMethod}</div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-widest text-gray-400 font-bold mb-1">Total Amount</div>
              <div className="text-2xl font-mono text-blue-900 font-bold">NPR {invoice.revenue?.toFixed(2)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
INNEREOF
