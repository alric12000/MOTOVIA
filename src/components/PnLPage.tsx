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
