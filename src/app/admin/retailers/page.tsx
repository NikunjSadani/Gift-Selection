'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

interface Retailer {
  id: string;
  retailerId: string;
  name: string;
  ownerName?: string | null;
  mobile: string;
  slabId?: string;
  status: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  landmark?: string | null;
  cso: string | null;
  csoPhone: string | null;
  slab: { name: string };
  submission?: { referenceId: string; submittedAt: string } | null;
}

interface Slab {
  id: string;
  name: string;
}

export default function RetailersPage() {
  const router = useRouter();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [slabs, setSlabs] = useState<Slab[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [slabFilter, setSlabFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    retailerId: '', name: '', ownerName: '', mobile: '',
    addressLine1: '', addressLine2: '', state: '', city: '', pincode: '',
    landmark: '', cso: '', csoPhone: '', slabId: '',
  });
  const [saving, setSaving] = useState(false);
  const [hardDeleteConfirm, setHardDeleteConfirm] = useState<Retailer | null>(null);
  const [hardDeleting, setHardDeleting] = useState(false);
  const [editRetailer, setEditRetailer] = useState<Retailer | null>(null);
  const [editForm, setEditForm] = useState({
    name: '', ownerName: '', mobile: '',
    addressLine1: '', addressLine2: '', state: '', city: '', pincode: '',
    landmark: '', cso: '', csoPhone: '', slabId: '',
  });
  const [editSaving, setEditSaving] = useState(false);
  const [uploadSummary, setUploadSummary] = useState<{
    imported: number;
    skipped: number;
    failed: number;
    reportRows: Record<string, unknown>[];
    unrecognisedColumns?: string[];
    detectedColumns?: string[];
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const limit = 20;

  useEffect(() => {
    fetch('/api/admin/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => { if (d?.admin?.role === 'superadmin') setIsSuperAdmin(true); })
      .catch(() => {});
  }, []);

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

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchRetailers(); }, [page, search, slabFilter, statusFilter]);

  const handleCreate = async () => {
    if (!form.retailerId || !form.name || !form.mobile || !form.slabId || !form.pincode) {
      toast.error('Retailer ID, Name, Phone Number, Slab and Pin Code are required');
      return;
    }
    if (!/^\d{10}$/.test(form.mobile)) {
      toast.error('Phone number must be exactly 10 digits');
      return;
    }
    if (!/^\d{6}$/.test(form.pincode)) {
      toast.error('Pin code must be exactly 6 digits');
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
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || 'Failed to create retailer');
      }
      toast.success('Retailer created');
      setShowModal(false);
      setForm({
        retailerId: '', name: '', ownerName: '', mobile: '',
        addressLine1: '', addressLine2: '', state: '', city: '', pincode: '',
        landmark: '', cso: '', csoPhone: '', slabId: '',
      });
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
    if (!confirm('Soft-delete this retailer? Their data will be kept but they cannot log in.')) return;
    try {
      await fetch(`/api/admin/retailers/${id}`, { method: 'DELETE', credentials: 'include' });
      toast.success('Retailer deactivated');
      fetchRetailers();
    } catch {
      toast.error('Failed to delete retailer');
    }
  };

  const handleHardDelete = async () => {
    if (!hardDeleteConfirm) return;
    setHardDeleting(true);
    try {
      const res = await fetch(`/api/admin/retailers/${hardDeleteConfirm.id}?hard=true`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('failed');
      toast.success(`Retailer ${hardDeleteConfirm.retailerId} permanently deleted`);
      setHardDeleteConfirm(null);
      fetchRetailers();
    } catch {
      toast.error('Failed to hard-delete retailer');
    } finally {
      setHardDeleting(false);
    }
  };

  const openEdit = (r: Retailer) => {
    setEditRetailer(r);
    setEditForm({
      name:         r.name         ?? '',
      ownerName:    r.ownerName    ?? '',
      mobile:       r.mobile       ?? '',
      addressLine1: r.addressLine1 ?? '',
      addressLine2: r.addressLine2 ?? '',
      state:        r.state        ?? '',
      city:         r.city         ?? '',
      pincode:      r.pincode      ?? '',
      landmark:     r.landmark     ?? '',
      cso:          r.cso          ?? '',
      csoPhone:     r.csoPhone     ?? '',
      slabId:       r.slabId       ?? '',
    });
  };

  const handleEdit = async () => {
    if (!editRetailer) return;
    if (!editForm.name || !editForm.mobile || !editForm.slabId || !editForm.pincode) {
      toast.error('Store Name, Phone Number, Slab and Pin Code are required');
      return;
    }
    if (!/^\d{10}$/.test(editForm.mobile)) {
      toast.error('Phone number must be exactly 10 digits');
      return;
    }
    if (!/^\d{6}$/.test(editForm.pincode)) {
      toast.error('Pin code must be exactly 6 digits');
      return;
    }
    setEditSaving(true);
    try {
      const res = await fetch(`/api/admin/retailers/${editRetailer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || d.error || 'Failed');
      }
      toast.success('Retailer updated');
      setEditRetailer(null);
      fetchRetailers();
    } catch (err) {
      toast.error(`Failed to update: ${(err as Error).message}`);
    } finally {
      setEditSaving(false);
    }
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileRef.current) fileRef.current.value = '';

    const toastId = 'bulk-upload';
    toast.loading('Reading file…', { id: toastId });

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

      if (rows.length === 0) {
        toast.error('The file has no data rows.', { id: toastId });
        return;
      }

      toast.loading(`Uploading ${rows.length} rows…`, { id: toastId });

      const res = await fetch('/api/admin/retailers/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rows }),
      });

      const result = await res.json();
      toast.dismiss(toastId);

      if (!res.ok) {
        toast.error(`Upload failed: ${result.error || 'server error'}`);
        return;
      }

      // Build per-row report using the rowResults array returned by the API
      type RowResult = { row: number; status: 'Imported' | 'Skipped' | 'Failed'; remark: string };
      const resultByIndex = new Map<number, RowResult>();
      (result.rowResults as RowResult[] || []).forEach((r) => {
        resultByIndex.set(r.row - 2, r); // row is 1-based with header → convert to 0-based index
      });

      const reportRows = rows.map((row, i) => {
        const r = resultByIndex.get(i);
        return {
          ...row,
          'Upload Status': r?.status ?? 'Imported',
          'Remarks': r?.remark ?? '',
        };
      });

      setUploadSummary({
        imported: result.imported,
        skipped: result.skipped ?? 0,
        failed: result.failed,
        reportRows,
        unrecognisedColumns: result.unrecognisedColumns ?? [],
        detectedColumns: result.detectedColumns ?? [],
      });

      // Auto-download the report when anything failed or was skipped so the
      // admin can immediately reconcile without hunting for the manual button.
      if ((result.failed ?? 0) > 0 || (result.skipped ?? 0) > 0) {
        downloadReportFrom(reportRows);
        toast.success('Report downloaded — check your Downloads folder');
      }

      fetchRetailers();
    } catch (err) {
      toast.dismiss(toastId);
      console.error('[bulk upload]', err);
      toast.error(`Upload failed: ${(err as Error).message}`);
    }
  };

  const downloadReportFrom = (reportRows: Record<string, unknown>[]) => {
    const ws = XLSX.utils.json_to_sheet(reportRows);
    // Color-hint: mark Upload Status column header
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Upload Report');
    const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbOut], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `retailer-upload-report-${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadReport = () => {
    if (!uploadSummary) return;
    downloadReportFrom(uploadSummary.reportRows);
  };

  const exportAllRetailers = async () => {
    toast.loading('Preparing export…', { id: 'export' });
    try {
      const res = await fetch('/api/admin/retailers/export', { credentials: 'include' });
      if (!res.ok) {
        toast.error('Failed to export retailers', { id: 'export' });
        return;
      }
      const data = await res.json();
      const ws = XLSX.utils.json_to_sheet(data.retailers);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Retailers');
      const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbOut], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `all-retailers-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${data.total} retailers`, { id: 'export' });
    } catch {
      toast.error('Failed to export retailers', { id: 'export' });
    }
  };

  const downloadTemplate = () => {
    // Column headers match exactly what the bulk-upload API expects
    const ws = XLSX.utils.json_to_sheet([
      {
        'Retailer ID':      'R001',
        'Retailer Name':    'Sample Store',
        'Owner Name':       'John Doe',
        'Phone Number':     '9999900001',
        'Address Line 1':   '123, MG Road',
        'Address Line 2':   'Near City Mall',
        'State':            'Maharashtra',
        'City':             'Mumbai',
        'Pin Code':         '400001',
        'Landmark':         'Near Railway Station',
        'CSO':              'Rahul Sharma',
        'CSO Phone Number': '9876543210',
        'Slab Winner':      '4K',
      },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Retailers');

    // Blob + anchor — reliable in all browsers (XLSX.writeFile uses fs which isn't available client-side)
    const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbOut], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'retailer-upload-template.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Retailers</h1>
        <div className="flex gap-2">
          <button onClick={downloadTemplate} className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            Download Template
          </button>
          <button onClick={exportAllRetailers} className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            Export All
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

      {/* Upload Result Banner */}
      {uploadSummary && (
        <div className={`rounded-xl p-4 mb-4 ${
          uploadSummary.failed === 0 ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'
        }`}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{uploadSummary.failed === 0 ? '✅' : '⚠️'}</span>
              <div>
                <div className="flex gap-4 text-sm font-semibold">
                  <span className="text-green-700">✓ {uploadSummary.imported} imported</span>
                  {uploadSummary.skipped > 0 && <span className="text-blue-600">⊘ {uploadSummary.skipped} skipped (already exist)</span>}
                  {uploadSummary.failed  > 0 && <span className="text-red-600">✕ {uploadSummary.failed} failed</span>}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">Download the report for row-by-row details and remarks.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={downloadReport}
                className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium whitespace-nowrap"
              >
                ⬇ Download Report
              </button>
              <button onClick={() => setUploadSummary(null)} className="text-gray-400 hover:text-gray-600 text-lg px-1">✕</button>
            </div>
          </div>

          {/* Column mapping diagnostic */}
          {(uploadSummary.unrecognisedColumns?.length ?? 0) > 0 && (
            <div className="mt-3 p-3 bg-white border border-amber-200 rounded-lg text-xs">
              <p className="font-semibold text-amber-700 mb-1">⚠ Unrecognised columns in your file (these were ignored):</p>
              <p className="text-gray-600 font-mono">{uploadSummary.unrecognisedColumns!.join(' · ')}</p>
              <p className="text-gray-500 mt-1">
                Mapped successfully: <span className="font-mono text-gray-700">{(uploadSummary.detectedColumns ?? []).join(' · ') || 'none'}</span>
              </p>
              <p className="text-gray-500 mt-1">
                Required columns: <span className="font-mono text-gray-700">Retailer ID · Retailer Name · Phone Number · Slab Winner</span>
              </p>
            </div>
          )}
        </div>
      )}

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
                <th className="text-left px-4 py-3 font-medium text-gray-500">CSO</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Submission</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-400">Loading...</td>
                </tr>
              ) : retailers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-400">No retailers found</td>
                </tr>
              ) : retailers.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{r.retailerId}</td>
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3">{r.mobile}</td>
                  <td className="px-4 py-3">{r.slab?.name}</td>
                  <td className="px-4 py-3">
                    {r.cso ? (
                      <div>
                        <p className="text-sm">{r.cso}</p>
                        {r.csoPhone && <p className="text-xs text-gray-400">{r.csoPhone}</p>}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
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
                    {isSuperAdmin ? (
                      <div className="flex gap-2 flex-wrap">
                        <button onClick={() => openEdit(r)} className="text-xs text-blue-600 hover:underline font-medium">✏ Edit</button>
                        {r.status === 'active' ? (
                          <button onClick={() => handleStatusChange(r.id, 'inactive')} className="text-xs text-amber-600 hover:underline">Deactivate</button>
                        ) : r.status === 'inactive' ? (
                          <button onClick={() => handleStatusChange(r.id, 'active')} className="text-xs text-green-600 hover:underline">Activate</button>
                        ) : null}
                        {r.status !== 'deleted' && (
                          <button onClick={() => handleDelete(r.id)} className="text-xs text-gray-500 hover:underline">Soft Delete</button>
                        )}
                        <button
                          onClick={() => setHardDeleteConfirm(r)}
                          className="text-xs text-red-600 font-bold hover:underline"
                        >
                          ⚡ Hard Delete
                        </button>
                      </div>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
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

      {/* ── Hard Delete Confirm ── */}
      {hardDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <div className="text-center mb-4">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-3xl">⚠️</span>
              </div>
              <h3 className="text-lg font-bold text-gray-800">Permanently Delete?</h3>
              <p className="text-sm text-gray-500 mt-2">
                This will permanently erase <span className="font-bold text-gray-800">{hardDeleteConfirm.name}</span> ({hardDeleteConfirm.retailerId})
                along with their submission and draft. <span className="text-red-600 font-semibold">This cannot be undone.</span>
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setHardDeleteConfirm(null)}
                className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium">
                Cancel
              </button>
              <button onClick={handleHardDelete} disabled={hardDeleting}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-xl text-sm font-bold disabled:opacity-60">
                {hardDeleting ? 'Deleting…' : 'Yes, Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Retailer Modal ── */}
      {editRetailer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-gray-800 mb-1">Edit Retailer</h3>
            <p className="text-xs text-gray-400 mb-4">ID: {editRetailer.retailerId}</p>
            <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-1">Required</p>
              {[
                { field: 'name',   label: 'Store Name *',   type: 'text' },
                { field: 'mobile', label: 'Phone Number *', type: 'tel'  },
              ].map(({ field, label, type }) => (
                <div key={field}>
                  <label className="block text-sm text-gray-600 mb-1">{label}</label>
                  <input
                    type={type}
                    value={editForm[field as keyof typeof editForm]}
                    onChange={(e) => setEditForm({ ...editForm, [field]: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E3000F]"
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm text-gray-600 mb-1">Slab Winner *</label>
                <select
                  value={editForm.slabId}
                  onChange={(e) => setEditForm({ ...editForm, slabId: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E3000F]"
                >
                  <option value="">Select slab</option>
                  {slabs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-2">Optional</p>
              {[
                { field: 'ownerName',    label: 'Owner Name',       type: 'text' },
                { field: 'addressLine1', label: 'Address Line 1',   type: 'text' },
                { field: 'addressLine2', label: 'Address Line 2',   type: 'text' },
                { field: 'landmark',     label: 'Landmark',         type: 'text' },
                { field: 'city',         label: 'City',             type: 'text' },
                { field: 'state',        label: 'State',            type: 'text' },
                { field: 'pincode',      label: 'Pin Code *',       type: 'text' },
                { field: 'cso',          label: 'CSO',              type: 'text' },
                { field: 'csoPhone',     label: 'CSO Phone Number', type: 'tel'  },
              ].map(({ field, label, type }) => (
                <div key={field}>
                  <label className="block text-sm text-gray-600 mb-1">{label}</label>
                  <input
                    type={type}
                    value={editForm[field as keyof typeof editForm]}
                    onChange={(e) => setEditForm({ ...editForm, [field]: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E3000F]"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setEditRetailer(null)}
                className="flex-1 border border-gray-200 py-2.5 rounded-xl text-sm text-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleEdit}
                disabled={editSaving}
                className="flex-1 bg-[#E3000F] text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {editSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Retailer Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Add Retailer</h3>
            <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
              {/* Required fields */}
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-1">Required</p>
              {[
                { field: 'retailerId',  label: 'Retailer ID *',  type: 'text' },
                { field: 'name',        label: 'Store Name *',   type: 'text' },
                { field: 'mobile',      label: 'Phone Number *', type: 'tel'  },
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
                <label className="block text-sm text-gray-600 mb-1">Slab Winner *</label>
                <select
                  value={form.slabId}
                  onChange={(e) => setForm({ ...form, slabId: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E3000F]"
                >
                  <option value="">Select slab</option>
                  {slabs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              {/* Optional fields */}
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-2">Optional</p>
              {[
                { field: 'ownerName',    label: 'Owner Name',       type: 'text' },
                { field: 'addressLine1', label: 'Address Line 1',   type: 'text' },
                { field: 'addressLine2', label: 'Address Line 2',   type: 'text' },
                { field: 'landmark',     label: 'Landmark',         type: 'text' },
                { field: 'city',         label: 'City',             type: 'text' },
                { field: 'state',        label: 'State',            type: 'text' },
                { field: 'pincode',      label: 'Pin Code *',       type: 'text' },
                { field: 'cso',          label: 'CSO',              type: 'text' },
                { field: 'csoPhone',     label: 'CSO Phone Number', type: 'tel'  },
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
