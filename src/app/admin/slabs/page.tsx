'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface Slab {
  id: string;
  name: string;
  internalCode: string;
  displayOrder: number;
  _count: { retailers: number; giftMappings: number };
}

export default function SlabsPage() {
  const router = useRouter();
  const [slabs, setSlabs] = useState<Slab[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editSlab, setEditSlab] = useState<Slab | null>(null);
  const [form, setForm] = useState({ name: '', internalCode: '', displayOrder: '0' });
  const [saving, setSaving] = useState(false);

  const fetchSlabs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/slabs', { credentials: 'include' });
      if (res.status === 401) { router.replace('/admin/login'); return; }
      const data = await res.json();
      setSlabs(data.slabs || []);
    } catch {
      toast.error('Failed to load slabs');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchSlabs(); }, []);

  const openCreate = () => {
    setEditSlab(null);
    setForm({ name: '', internalCode: '', displayOrder: '0' });
    setShowModal(true);
  };

  const openEdit = (slab: Slab) => {
    setEditSlab(slab);
    setForm({ name: slab.name, internalCode: slab.internalCode, displayOrder: String(slab.displayOrder) });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.internalCode) { toast.error('Name and code required'); return; }
    setSaving(true);
    try {
      const url = editSlab ? `/api/admin/slabs/${editSlab.id}` : '/api/admin/slabs';
      const method = editSlab ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...form, displayOrder: parseInt(form.displayOrder) }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(editSlab ? 'Slab updated' : 'Slab created');
      setShowModal(false);
      fetchSlabs();
    } catch {
      toast.error('Failed to save slab');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (slab: Slab) => {
    if (slab._count.retailers > 0) {
      toast.error(`Cannot delete: ${slab._count.retailers} retailers assigned`);
      return;
    }
    if (!confirm('Delete this slab?')) return;
    try {
      const res = await fetch(`/api/admin/slabs/${slab.id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error === 'slab_has_retailers' ? `Slab has ${d.count} retailers` : 'Failed to delete');
        return;
      }
      toast.success('Slab deleted');
      fetchSlabs();
    } catch {
      toast.error('Failed to delete slab');
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#E3000F]" /></div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Slabs</h1>
        <button onClick={openCreate} className="px-4 py-2 bg-[#E3000F] text-white text-sm font-medium rounded-lg">+ Add Slab</button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Internal Code</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Display Order</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Retailers</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Gifts</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {slabs.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3 font-mono text-xs">{s.internalCode}</td>
                <td className="px-4 py-3">{s.displayOrder}</td>
                <td className="px-4 py-3">{s._count.retailers}</td>
                <td className="px-4 py-3">{s._count.giftMappings}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(s)} className="text-xs text-blue-500 hover:underline">Edit</button>
                    <button onClick={() => handleDelete(s)} className="text-xs text-red-500 hover:underline">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {slabs.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">No slabs found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-4">{editSlab ? 'Edit Slab' : 'Add Slab'}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E3000F]"
                  placeholder="e.g. 2K" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Internal Code *</label>
                <input value={form.internalCode} onChange={(e) => setForm({ ...form, internalCode: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E3000F]"
                  placeholder="e.g. TIER_1" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Display Order</label>
                <input type="number" value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E3000F]" />
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
