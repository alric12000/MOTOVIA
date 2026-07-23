import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Sale, Expense, AdSpend, Product, Customer } from '../types';

export function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    revenue: 0,
    cogs: 0,
    expenses: 0,
    adSpend: 0,
    orders: 0,
    customers: 0,
    lowStock: 0,
  });

  useEffect(() => {
    // Fetch data and calculate metrics
    const fetchData = async () => {
      try {
        const salesSnap = await getDocs(collection(db, 'sales'));
        const expSnap = await getDocs(collection(db, 'expenses'));
        const adSnap = await getDocs(collection(db, 'ad_spend'));
        const prodSnap = await getDocs(collection(db, 'products'));
        const custSnap = await getDocs(collection(db, 'customers'));

        let rev = 0;
        let cogs = 0;
        salesSnap.forEach(doc => {
          const d = doc.data();
          rev += d.revenue || 0;
          cogs += d.cost || 0;
        });

        let exp = 0;
        expSnap.forEach(doc => {
          exp += doc.data().amount || 0;
        });

        let ads = 0;
        adSnap.forEach(doc => {
          ads += doc.data().amount || 0;
        });

        let low = 0;
        prodSnap.forEach(doc => {
          const p = doc.data();
          if (p.stock <= p.reorderLevel) low++;
        });

        setMetrics({
          revenue: rev,
          cogs: cogs,
          expenses: exp,
          adSpend: ads,
          orders: salesSnap.size,
          customers: custSnap.size,
          lowStock: low,
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const netProfit = metrics.revenue - metrics.cogs - metrics.expenses - metrics.adSpend;

  return (
    <div className="space-y-6 p-4 md:p-8">
      <header className="mb-8">
        <h1 className="text-xl font-serif italic text-white">Business Dashboard</h1>
        <p className="text-xs text-white/40 tracking-wide uppercase mt-1">Live KPIs</p>
      </header>
      
      {loading ? (
        <div className="text-white/40 text-sm">Loading dashboard...</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl">
            <div className="text-[10px] uppercase text-white/40 mb-1">Total Revenue</div>
            <div className="text-2xl font-mono text-white">NPR {metrics.revenue.toLocaleString()}</div>
          </div>
          <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl">
            <div className="text-[10px] uppercase text-rose-500/70 mb-1">Total COGS</div>
            <div className="text-2xl font-mono text-rose-500">NPR {metrics.cogs.toLocaleString()}</div>
          </div>
          <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl">
            <div className="text-[10px] uppercase text-amber-500/70 mb-1">Total Expenses</div>
            <div className="text-2xl font-mono text-amber-500">NPR {metrics.expenses.toLocaleString()}</div>
          </div>
          <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl">
            <div className="text-[10px] uppercase text-amber-500/70 mb-1">Total Ad Spend</div>
            <div className="text-2xl font-mono text-amber-500">NPR {metrics.adSpend.toLocaleString()}</div>
          </div>
          <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl col-span-2">
            <div className="text-[10px] uppercase text-emerald-500/70 mb-1">Net Profit</div>
            <div className="text-3xl font-mono text-emerald-500">NPR {netProfit.toLocaleString()}</div>
          </div>
          <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl">
            <div className="text-[10px] uppercase text-white/40 mb-1">Total Orders</div>
            <div className="text-2xl font-mono text-blue-500">{metrics.orders}</div>
          </div>
          <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl">
            <div className="text-[10px] uppercase text-white/40 mb-1">Low Stock Items</div>
            <div className="text-2xl font-mono text-rose-500">{metrics.lowStock}</div>
          </div>
        </div>
      )}
    </div>
  );
}
