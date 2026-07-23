import { useState, useEffect, FormEvent } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { Expense } from '../types';
import { handleFirestoreError } from '../utils';
import { OperationType } from '../types';
import { Plus, Trash2, X } from 'lucide-react';

export function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    category: '',
    description: '',
    amount: '',
    paymentMethod: 'Cash'
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'expenses'), (snapshot) => {
      const exps: Expense[] = [];
      snapshot.forEach((doc) => exps.push({ id: doc.id, ...doc.data() } as Expense));
      setExpenses(exps);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'expenses'));
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'expenses'), {
        date: formData.date,
        category: formData.category,
        description: formData.description,
        amount: Number(formData.amount),
        paymentMethod: formData.paymentMethod
      });
      setIsModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'expenses');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure?')) {
      try {
        await deleteDoc(doc(db, 'expenses', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'expenses');
      }
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-8">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-serif italic text-white">Expense Tracker</h1>
          <p className="text-xs text-white/40 tracking-wide uppercase mt-1">Log every business expense</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="px-5 py-2 bg-rose-600 text-white text-xs font-bold uppercase tracking-widest rounded shadow-[0_0_20px_rgba(225,20,60,0.3)] hover:bg-rose-700 transition-colors flex items-center">
          <Plus className="w-4 h-4 mr-2" /> Add Expense
        </button>
      </header>
      
      <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden flex flex-col">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="bg-white/[0.03] text-[10px] uppercase tracking-widest font-bold text-slate-300 border-b border-white/5">
            <tr>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">Category</th>
              <th className="px-6 py-4">Description</th>
              <th className="px-6 py-4 text-right">Amount</th>
              <th className="px-6 py-4 text-center">Payment Method</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.02]">
            {loading ? <tr><td colSpan={6} className="px-6 py-8 text-center text-white/40 text-xs">Loading...</td></tr> : 
             expenses.map(e => (
              <tr key={e.id} className="hover:bg-white/[0.01]">
                <td className="px-6 py-4 text-white/60 font-mono text-xs">{e.date}</td>
                <td className="px-6 py-4 text-white">{e.category}</td>
                <td className="px-6 py-4 text-white/60">{e.description}</td>
                <td className="px-6 py-4 text-right text-rose-500 font-mono text-xs">NPR {e.amount.toFixed(2)}</td>
                <td className="px-6 py-4 text-center text-white/60 text-xs">{e.paymentMethod}</td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => handleDelete(e.id)} className="text-white/30 hover:text-rose-500"><Trash2 className="w-4 h-4 inline" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden p-6">
            <h2 className="text-sm uppercase tracking-[0.2em] text-white font-bold mb-4">Add Expense</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input required type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded text-white text-sm [&::-webkit-calendar-picker-indicator]:invert-[0.8]" />
              <input required type="text" placeholder="Category" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded text-white text-sm" />
              <input required type="text" placeholder="Description" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded text-white text-sm" />
              <input required type="number" placeholder="Amount" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded text-white text-sm" />
              <button type="submit" className="w-full py-2 bg-rose-600 text-white rounded font-bold uppercase tracking-widest text-xs">Save</button>
              <button type="button" onClick={() => setIsModalOpen(false)} className="w-full py-2 border border-white/20 text-white rounded font-bold uppercase tracking-widest text-xs">Cancel</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
