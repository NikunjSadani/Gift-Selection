'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

interface Retailer {
  id: string;
  retailerId: string;
  name: string;
  mobile: string;
  status: string;
  slab: { name: string };
  submission?: { referenceId: string; submittedAt: string } | null;
}

interface Slab {
  id: string;
  name: string;
}

export default function RetailersPage() {
  const router = useRouter();
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [slabs, setSlabs] = useState<Slab[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [slabFilter, setSlabFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ retailerId: '', name: '', ownerName: '', mobile: '', slabId: '' });
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const limit = 20;

  const fetchRetailers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      if (slabFilter) params.set('slab', slabFilter);
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/admin/retailers?${params}`, { credentials: 'include' });
      if (res.status === 401) { router.replace('/admin/login'); return; }
      const data = await res.json();
      setRetailers(data.retailers || []);
      setTotal(data.total || 0);
    } catch {
      toast.error('Failed to load retailers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch('/api/admin/slabs', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setSlabs(d.slabs || []));
  }, []);

  useEffect(() => { fetchRetailers(); }, [page, search, slabFilter, statusFilter]);

  const handleCreate = async () => {
    if (!form.retailerId || !form.name || !form.mobile || !form.slabId) {
      toast.error('Please fill all required fields');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/retailers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Retailer created');
      setShowModal(false);
      setForm({ retailerId: '', name: '', ownerName: '', mobile: '', slabId: '' });
      fetchRetailers();
    } catch {
      toast.error('Failed to create retailer');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await fetch(`/api/admin/retailers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      toast.success('Status updated');
      fetchRetailers();
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this retailer?')) return;
    try {
      await fetch(`/api/admin/retailers/${id}`, { method: 'DELETE', credentials: 'include' });
      toast.success('Retailer deleted');
      fetchRetailers();
    } catch {
      toast.error('Failed to delete retailer');
    }
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws) as Record<string, string>[];

      const res = await fetch('/api/admin/retailers/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rows }),
      });
      const result = await res.json();
      toast.success(`Imported ${result.imported}, failed ${result.failed}`);
      fetchRetailers();
    } catch {
      toast.error('Bulk import failed');
    }

    if (fileRef.current) fileRef.current.value = '';
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { retailerId: 'R001', name: 'Sample Store', ownerName: 'John Doe', mobile: '9999900001', slabId: 'TIER_1', ndaCode: '', addressLine1: '', city: '', state: '', pincode: '' },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Retailers');
    XLSX.writeFile(wb, 'retailer-template.xlsx');
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Retailers</h1>
        <div className="flex gap-2">
          <button onClick={downloadTemplate} className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            Download Template
          </button>
          <button onClick={() => fileRef.current?.click()} className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            Bulk Upload
          </button>
          <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-[#E3000F] text-white text-sm font-medium rounded-lg">
            + Add Retailer
          </button>
        </div>
        <input ref={fileRef} type="file" accept=".xlsx,.csv" onChange={handleBulkUpload} className="hidden" />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 mb-4 flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by name, mobile, ID..."
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-48 focus:outline-none focus:border-[#E3000F]"
        />
        <select
          value={slabFilter}
          onChange={(e) => { setSlabFilter(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E3000F]"
        >
          <option value="">All Slabs</option>
          {slabs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E3000F]"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Retailer ID</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Mobile</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Slab</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Submission</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-400">Loading...</td>
                </tr>
              ) : retailers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-400">No retailers found</td>
                </tr>
              ) : retailers.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{r.retailerId}</td>
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3">{r.mobile}</td>
                  <td className="px-4 py-3">{r.slab?.name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      r.status === 'active' ? 'bg-green-100 text-green-700' :
                      r.status === 'deleted' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {r.submission ? (
                      <span className="text-green-600 font-medium text-xs">{r.submission.referenceId}</span>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {r.status === 'active' ? (
                        <button onClick={() => handleStatusChange(r.id, 'inactive')} className="text-xs text-amber-600 hover:underline">Deactivate</button>
                      ) : r.status === 'inactive' ? (
                        <button onClick={() => handleStatusChange(r.id, 'active')} className="text-xs text-green-600 hover:underline">Activate</button>
                      ) : null}
                      <button onClick={() => handleDelete(r.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t flex justify-between items-center">
          <p className="text-sm text-gray-500">
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40"
            >Prev</button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page * limit >= total}
              className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40"
            >Next</button>
          </div>
        </div>
      </div>

      {/* Add Retailer Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Add Retailer</h3>
            <div className="space-y-3">
              {[
                { field: 'retailerId', label: 'Retailer ID *', type: 'text' },
                { field: 'name', label: 'Store Name *', type: 'text' },
                { field: 'ownerName', label: 'Owner Name', type: 'text' },
                { field: 'mobile', label: 'Mobile *', type: 'tel' },
              ].map(({ field, label, type }) => (
                <div key={field}>
                  <label className="block text-sm text-gray-600 mb-1">{label}</label>
                  <input
                    type={type}
                    value={form[field as keyof typeof form]}
                    onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E3000F]"
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm text-gray-600 mb-1">Slab *</label>
                <select
                  value={form.slabId}
                  onChange={(e) => setForm({ ...form, slabId: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E3000F]"
                >
                  <option value="">Select slab</option>
                  {slabs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-200 py-2.5 rounded-xl text-sm text-gray-600">Cancel</button>
              <button onClick={handleCreate} disabled={saving} className="flex-1 bg-[#E3000F] text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
                {saving ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
