'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface Slab {
  id: string;
  name: string;
}

interface Gift {
  id: string;
  name: string;
  description: string;
  sku: string | null;
  mrp: number | null;
  showMrp: boolean;
  status: string;
  slabMappings: { slab: Slab }[];
  _count: { submissions: number };
}

export default function GiftsPage() {
  const router = useRouter();
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [slabs, setSlabs] = useState<Slab[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editGift, setEditGift] = useState<Gift | null>(null);
  const [form, setForm] = useState({ name: '', description: '', sku: '', mrp: '', showMrp: false, slabIds: [] as string[] });
  const [saving, setSaving] = useState(false);

  const fetchGifts = async () => {
    setLoading(true);
    try {
      const [giftsRes, slabsRes] = await Promise.all([
        fetch('/api/admin/gifts', { credentials: 'include' }),
        fetch('/api/admin/slabs', { credentials: 'include' }),
      ]);
      if (giftsRes.status === 401) { router.replace('/admin/login'); return; }
      const gData = await giftsRes.json();
      const sData = await slabsRes.json();
      setGifts(gData.gifts || []);
      setSlabs(sData.slabs || []);
    } catch {
      toast.error('Failed to load gifts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchGifts(); }, []);

  const openCreate = () => {
    setEditGift(null);
    setForm({ name: '', description: '', sku: '', mrp: '', showMrp: false, slabIds: [] });
    setShowModal(true);
  };

  const openEdit = (gift: Gift) => {
    setEditGift(gift);
    setForm({
      name: gift.name,
      description: gift.description,
      sku: gift.sku || '',
      mrp: gift.mrp ? String(gift.mrp) : '',
      showMrp: gift.showMrp,
      slabIds: gift.slabMappings.map((m) => m.slab.id),
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.description) { toast.error('Name and description required'); return; }
    setSaving(true);
    try {
      const url = editGift ? `/api/admin/gifts/${editGift.id}` : '/api/admin/gifts';
      const method = editGift ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...form, slabIds: form.slabIds }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(editGift ? 'Gift updated' : 'Gift created');
      setShowModal(false);
      fetchGifts();
    } catch {
      toast.error('Failed to save gift');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (gift: Gift) => {
    try {
      await fetch(`/api/admin/gifts/${gift.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...gift, status: gift.status === 'active' ? 'inactive' : 'active', slabIds: gift.slabMappings.map(m => m.slab.id) }),
      });
      toast.success('Status updated');
      fetchGifts();
    } catch {
      toast.error('Failed to update');
    }
  };

  const toggleSlab = (slabId: string) => {
    setForm((f) => ({
      ...f,
      slabIds: f.slabIds.includes(slabId) ? f.slabIds.filter((id) => id !== slabId) : [...f.slabIds, slabId],
    }));
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#E3000F]" /></div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Gifts</h1>
        <button onClick={openCreate} className="px-4 py-2 bg-[#E3000F] text-white text-sm font-medium rounded-lg">+ Add Gift</button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Gift</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Slabs</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">MRP</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Submissions</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {gifts.map((g) => (
              <tr key={g.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium">{g.name}</p>
                  <p className="text-gray-400 text-xs truncate max-w-xs">{g.description}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {g.slabMappings.map((m) => (
                      <span key={m.slab.id} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">{m.slab.name}</span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">{g.mrp ? `₹${g.mrp}` : '—'}</td>
                <td className="px-4 py-3">{g._count.submissions}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${g.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {g.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(g)} className="text-xs text-blue-500 hover:underline">Edit</button>
                    <button onClick={() => handleToggleStatus(g)} className="text-xs text-amber-500 hover:underline">
                      {g.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {gifts.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">No gifts found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-800 mb-4">{editGift ? 'Edit Gift' : 'Add Gift'}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E3000F]" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Description *</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E3000F]" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">SKU</label>
                <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E3000F]" />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm text-gray-600 mb-1">MRP (₹)</label>
                  <input type="number" value={form.mrp} onChange={(e) => setForm({ ...form, mrp: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E3000F]" />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input type="checkbox" checked={form.showMrp} onChange={(e) => setForm({ ...form, showMrp: e.target.checked })} />
                    Show MRP
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-2">Assign to Slabs</label>
                <div className="flex flex-wrap gap-2">
                  {slabs.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleSlab(s.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                        form.slabIds.includes(s.id) ? 'bg-[#E3000F] text-white border-[#E3000F]' : 'border-gray-200 text-gray-600'
                      }`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-200 py-2.5 rounded-xl text-sm text-gray-600">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-[#E3000F] text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
