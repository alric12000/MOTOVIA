import { useState, useEffect, FormEvent } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { Product, OperationType } from '../types';
import { handleFirestoreError } from '../utils';
import { Plus, Edit, Trash2, X } from 'lucide-react';

export function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: '',
    costPrice: '',
    sellingPrice: '',
    stock: '',
    reorderLevel: ''
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'products'), (snapshot) => {
      const prods: Product[] = [];
      snapshot.forEach((doc) => {
        prods.push({ id: doc.id, ...doc.data() } as Product);
      });
      setProducts(prods);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
    });

    return () => unsubscribe();
  }, []);

  const openModal = (product?: Product) => {
    if (product) {
      setEditingId(product.id);
      setFormData({
        name: product.name,
        sku: product.sku,
        category: product.category,
        costPrice: product.costPrice.toString(),
        sellingPrice: product.sellingPrice.toString(),
        stock: product.stock.toString(),
        reorderLevel: product.reorderLevel.toString(),
      });
    } else {
      setEditingId(null);
      setFormData({ name: '', sku: '', category: '', costPrice: '', sellingPrice: '', stock: '', reorderLevel: '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const data = {
      name: formData.name,
      sku: formData.sku,
      category: formData.category,
      costPrice: Number(formData.costPrice),
      sellingPrice: Number(formData.sellingPrice),
      stock: Number(formData.stock),
      reorderLevel: Number(formData.reorderLevel)
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, 'products', editingId), data);
      } else {
        await addDoc(collection(db, 'products'), data);
      }
      setIsModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'products');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this product?')) {
      try {
        await deleteDoc(doc(db, 'products', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'products');
      }
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-8">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-serif italic text-white">Inventory Management</h1>
          <p className="text-xs text-white/40 tracking-wide uppercase mt-1">Manage your product catalog and stock levels.</p>
        </div>
        <button
          onClick={() => openModal()}
          className="px-5 py-2 bg-rose-600 text-white text-xs font-bold uppercase tracking-widest rounded shadow-[0_0_20px_rgba(225,20,60,0.3)] hover:bg-rose-700 transition-colors flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Product
        </button>
      </header>

      <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-white/[0.03] text-[10px] uppercase tracking-widest font-bold text-slate-300 border-b border-white/5">
              <tr>
                <th className="px-6 py-4 font-semibold">Product</th>
                <th className="px-6 py-4 font-semibold">SKU</th>
                <th className="px-6 py-4 font-semibold text-right">Cost Price</th>
                <th className="px-6 py-4 font-semibold text-right">Selling Price</th>
                <th className="px-6 py-4 font-semibold text-right">Stock</th>
                <th className="px-6 py-4 font-semibold text-center">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-white/40 text-xs tracking-widest uppercase">Loading inventory...</td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-white/40 text-xs tracking-widest uppercase">No products found. Add one to get started.</td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="hover:bg-white/[0.01] transition-colors items-center text-sm">
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">{product.name}</div>
                      <div className="text-xs text-white/40 mt-0.5 uppercase tracking-widest">{product.category}</div>
                    </td>
                    <td className="px-6 py-4 text-white/60 font-mono text-xs">{product.sku}</td>
                    <td className="px-6 py-4 text-right text-white/60 font-mono text-xs">NPR {product.costPrice.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right text-white font-mono text-xs">NPR {product.sellingPrice.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={`font-mono text-xs ${product.stock <= product.reorderLevel ? 'text-rose-500' : 'text-slate-300'}`}>
                        {product.stock}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {product.stock <= product.reorderLevel ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase bg-rose-500/10 text-rose-500 border border-rose-500/20">
                          Low Stock
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                          In Stock
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-3">
                      <button onClick={() => openModal(product)} className="text-white/30 hover:text-white transition-colors">
                        <Edit className="w-4 h-4 inline" />
                      </button>
                      <button onClick={() => handleDelete(product.id)} className="text-white/30 hover:text-rose-500 transition-colors">
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
              <h2 className="text-sm uppercase tracking-[0.2em] text-white font-bold">{editingId ? 'Edit Product' : 'Add Product'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-white/40 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-2">Product Name</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded focus:outline-none focus:border-rose-500 text-white text-sm" placeholder="e.g. Wash Combo" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-2">SKU</label>
                  <input required type="text" value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded focus:outline-none focus:border-rose-500 text-white text-sm" placeholder="SKU-001" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-2">Category</label>
                  <input required type="text" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded focus:outline-none focus:border-rose-500 text-white text-sm" placeholder="Auto Care" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-2">Cost Price (NPR)</label>
                  <input required type="number" step="0.01" value={formData.costPrice} onChange={e => setFormData({...formData, costPrice: e.target.value})} className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded focus:outline-none focus:border-rose-500 text-white text-sm" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-2">Selling Price (NPR)</label>
                  <input required type="number" step="0.01" value={formData.sellingPrice} onChange={e => setFormData({...formData, sellingPrice: e.target.value})} className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded focus:outline-none focus:border-rose-500 text-white text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-2">Current Stock</label>
                  <input required type="number" value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded focus:outline-none focus:border-rose-500 text-white text-sm" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-2">Reorder Level</label>
                  <input required type="number" value={formData.reorderLevel} onChange={e => setFormData({...formData, reorderLevel: e.target.value})} className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded focus:outline-none focus:border-rose-500 text-white text-sm" />
                </div>
              </div>
              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2 border border-white/20 rounded text-[10px] uppercase font-bold tracking-widest hover:bg-white/5 transition-colors text-white">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-rose-600 text-white text-[10px] font-bold uppercase tracking-widest rounded shadow-[0_0_20px_rgba(225,20,60,0.3)] hover:bg-rose-700 transition-colors">{editingId ? 'Save Changes' : 'Add Product'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
