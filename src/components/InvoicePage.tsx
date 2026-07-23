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
