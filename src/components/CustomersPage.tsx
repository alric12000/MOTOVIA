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
