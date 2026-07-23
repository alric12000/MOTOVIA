import { useState, useEffect, FormEvent } from 'react';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Sale, Product, OperationType } from '../types';
import { handleFirestoreError } from '../utils';
import { Plus, Trash2, Edit, X } from 'lucide-react';
import { format } from 'date-fns';

export function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    orderId: '',
    customerName: '',
    productId: '',
    platform: 'Instagram',
    quantity: '1',
    paymentMethod: 'COD',
    deliveryStatus: 'Delivered',
    notes: ''
  });

  useEffect(() => {
    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      const prods: Product[] = [];
      snapshot.forEach(d => prods.push({ id: d.id, ...d.data() } as Product));
      setProducts(prods);
    });

    const unsubSales = onSnapshot(collection(db, 'sales'), (snapshot) => {
      const sls: Sale[] = [];
      snapshot.forEach(d => sls.push({ id: d.id, ...d.data() } as Sale));
      sls.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setSales(sls);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'sales'));

    return () => {
      unsubProducts();
      unsubSales();
    };
  }, []);

  const openModal = () => {
    setFormData({
      date: format(new Date(), 'yyyy-MM-dd'),
      orderId: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      customerName: '',
      productId: products.length > 0 ? products[0].id : '',
      platform: 'Instagram',
      quantity: '1',
      paymentMethod: 'COD',
      deliveryStatus: 'Delivered',
      notes: ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const product = products.find(p => p.id === formData.productId);
    if (!product) return;

    const qty = Number(formData.quantity);
    const revenue = product.sellingPrice * qty;
    const cost = product.costPrice * qty;
    const profit = revenue - cost;

    const newSale = {
      date: formData.date,
      orderId: formData.orderId,
      customerName: formData.customerName,
      productId: product.id,
      productName: product.name,
      platform: formData.platform,
      quantity: qty,
      costPrice: product.costPrice,
      sellingPrice: product.sellingPrice,
      revenue,
      cost,
      profit,
      paymentMethod: formData.paymentMethod,
      deliveryStatus: formData.deliveryStatus,
      notes: formData.notes
    };

    try {
      await addDoc(collection(db, 'sales'), newSale);
      setIsModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'sales');
    }
  };

  const handleDelete = async (id: string) => {
    if(confirm('Delete this sales record?')) {
      try {
        await deleteDoc(doc(db, 'sales', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'sales');
      }
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-8">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-serif italic text-white">Sales Tracker</h1>
          <p className="text-xs text-white/40 tracking-wide uppercase mt-1">Record and monitor all sales transactions.</p>
        </div>
        <button
          onClick={openModal}
          className="px-5 py-2 bg-rose-600 text-white text-xs font-bold uppercase tracking-widest rounded shadow-[0_0_20px_rgba(225,20,60,0.3)] hover:bg-rose-700 transition-colors flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Sale
        </button>
      </header>

      <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-white/[0.03] text-[10px] uppercase tracking-widest font-bold text-slate-300 border-b border-white/5">
              <tr>
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold">Order ID</th>
                <th className="px-6 py-4 font-semibold">Customer</th>
                <th className="px-6 py-4 font-semibold">Product</th>
                <th className="px-6 py-4 font-semibold">Platform</th>
                <th className="px-6 py-4 font-semibold text-right">Qty</th>
                <th className="px-6 py-4 font-semibold text-right">Revenue</th>
                <th className="px-6 py-4 font-semibold text-right">Profit</th>
                <th className="px-6 py-4 font-semibold text-center">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {loading ? (
                <tr><td colSpan={10} className="px-6 py-8 text-center text-white/40 text-xs tracking-widest uppercase">Loading sales...</td></tr>
              ) : sales.length === 0 ? (
                <tr><td colSpan={10} className="px-6 py-8 text-center text-white/40 text-xs tracking-widest uppercase">No sales recorded yet.</td></tr>
              ) : (
                sales.map(sale => (
                  <tr key={sale.id} className="hover:bg-white/[0.01] transition-colors items-center text-sm">
                    <td className="px-6 py-4 text-white/40 font-mono text-xs">{sale.date}</td>
                    <td className="px-6 py-4 font-medium text-rose-500 text-xs font-mono">{sale.orderId}</td>
                    <td className="px-6 py-4 text-white font-serif italic">{sale.customerName}</td>
                    <td className="px-6 py-4 text-white/60 text-xs">{sale.productName || 'Unknown'}</td>
                    <td className="px-6 py-4 text-white/60 text-xs">{sale.platform}</td>
                    <td className="px-6 py-4 text-right text-white/60 font-mono text-xs">{sale.quantity}</td>
                    <td className="px-6 py-4 text-right font-medium text-white font-mono text-xs">NPR {sale.revenue?.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right font-medium text-emerald-500 font-mono text-xs">NPR {sale.profit?.toFixed(2)}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase bg-white/5 text-white/60 border border-white/10">
                        {sale.deliveryStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => handleDelete(sale.id)} className="text-white/30 hover:text-rose-500 transition-colors">
                        <Trash2 className="w-4 h-4 inline" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden text-slate-300">
            <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
              <h2 className="text-sm uppercase tracking-[0.2em] text-white font-bold">Record Sale</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-white/40 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-2">Date</label>
                  <input required type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded focus:outline-none focus:border-rose-500 text-white text-sm [&::-webkit-calendar-picker-indicator]:invert-[0.8]" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-2">Order ID</label>
                  <input required type="text" value={formData.orderId} onChange={e => setFormData({...formData, orderId: e.target.value})} className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded focus:outline-none focus:border-rose-500 text-white text-sm" />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-2">Customer Name</label>
                  <input required type="text" value={formData.customerName} onChange={e => setFormData({...formData, customerName: e.target.value})} className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded focus:outline-none focus:border-rose-500 text-white text-sm" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-2">Platform</label>
                  <input required type="text" value={formData.platform} onChange={e => setFormData({...formData, platform: e.target.value})} className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded focus:outline-none focus:border-rose-500 text-white text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-2">Product</label>
                  <select required value={formData.productId} onChange={e => setFormData({...formData, productId: e.target.value})} className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded focus:outline-none focus:border-rose-500 text-white text-sm">
                    <option value="" disabled className="bg-[#0a0a0a] text-white">Select Product...</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id} className="bg-[#0a0a0a] text-white">{p.name} - NPR {p.sellingPrice}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-2">Qty</label>
                  <input required type="number" min="1" value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded focus:outline-none focus:border-rose-500 text-white text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-2">Payment Method</label>
                  <select value={formData.paymentMethod} onChange={e => setFormData({...formData, paymentMethod: e.target.value})} className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded focus:outline-none focus:border-rose-500 text-white text-sm">
                    <option className="bg-[#0a0a0a] text-white">COD</option>
                    <option className="bg-[#0a0a0a] text-white">Bank Transfer</option>
                    <option className="bg-[#0a0a0a] text-white">eSewa</option>
                    <option className="bg-[#0a0a0a] text-white">Khalti</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-2">Status</label>
                  <select value={formData.deliveryStatus} onChange={e => setFormData({...formData, deliveryStatus: e.target.value})} className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded focus:outline-none focus:border-rose-500 text-white text-sm">
                    <option className="bg-[#0a0a0a] text-white">Processing</option>
                    <option className="bg-[#0a0a0a] text-white">Shipped</option>
                    <option className="bg-[#0a0a0a] text-white">Delivered</option>
                    <option className="bg-[#0a0a0a] text-white">Cancelled</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-2">Notes</label>
                <input type="text" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded focus:outline-none focus:border-rose-500 text-white text-sm" />
              </div>

              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2 border border-white/20 rounded text-[10px] uppercase font-bold tracking-widest hover:bg-white/5 transition-colors text-white">Cancel</button>
                <button type="submit" disabled={!formData.productId} className="px-5 py-2 bg-rose-600 text-white text-[10px] font-bold uppercase tracking-widest rounded shadow-[0_0_20px_rgba(225,20,60,0.3)] hover:bg-rose-700 transition-colors disabled:opacity-50 disabled:shadow-none">Save Sale</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
