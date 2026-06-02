'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

interface Submission {
  id: string;
  referenceId: string;
  storeName: string;
  ownerName: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  pincode: string;
  landmark: string | null;
  gstNumber: string | null;
  alternateMobile: string | null;
  detailsEdited: boolean;
  documentUrl: string | null;
  documentType: string | null;
  whatsappSent: boolean;
  whatsappSentAt: string | null;
  submittedAt: string;
  retailer: {
    retailerId: string;
    mobile: string;
    ownerName: string | null;
    cso: string | null;
    csoPhone: string | null;
    slab: { name: string };
  };
  gift: { id: string; name: string };
}

interface Slab { id: string; name: string }
interface Gift { id: string; name: string }

export default function SubmissionsPage() {
  const router = useRouter();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [slabs, setSlabs] = useState<Slab[]>([]);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedSub, setSelectedSub] = useState<Submission | null>(null);
  const [editingSub, setEditingSub] = useState<Submission | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Submission | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const limit = 20;

  const [filters, setFilters] = useState({
    slabId: '', giftId: '', city: '', state: '', detailsEdited: '', dateFrom: '', dateTo: '',
  });

  // Edit form state
  const [editForm, setEditForm] = useState({
    storeName: '', ownerName: '', addressLine1: '', addressLine2: '',
    city: '', state: '', pincode: '', gstNumber: '', landmark: '',
    alternateMobile: '', giftId: '',
  });

  useEffect(() => {
    fetch('/api/admin/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => { if (d?.admin?.role === 'superadmin') setIsSuperAdmin(true); })
      .catch(() => {});
  }, []);

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
      const res = await fetch(`/api/admin/submissions?${params}`, { credentials: 'include' });
      if (res.status === 401) { router.replace('/admin/login'); return; }
      const data = await res.json();
      setSubmissions(data.submissions || []);
      setTotal(data.total || 0);
    } catch {
      toast.error('Failed to load submissions');
    } finally {
      setLoading(false);
    }
  }, [page, filters, router]);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/slabs', { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/admin/gifts', { credentials: 'include' }).then((r) => r.json()),
    ]).then(([sData, gData]) => {
      setSlabs(sData.slabs || []);
      setGifts(gData.gifts || []);
    });
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchSubmissions(); }, [fetchSubmissions]);

  const openEdit = (sub: Submission, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditForm({
      storeName: sub.storeName,
      ownerName: sub.ownerName,
      addressLine1: sub.addressLine1,
      addressLine2: sub.addressLine2 || '',
      city: sub.city,
      state: sub.state,
      pincode: sub.pincode,
      gstNumber: sub.gstNumber || '',
      landmark: sub.landmark || '',
      alternateMobile: sub.alternateMobile || '',
      giftId: sub.gift.id,
    });
    setEditingSub(sub);
  };

  const handleSaveEdit = async () => {
    if (!editingSub) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/submissions/${editingSub.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error('save failed');
      toast.success('Submission updated');
      setEditingSub(null);
      fetchSubmissions();
    } catch {
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/submissions/${deleteConfirm.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('delete failed');
      toast.success(`Submission ${deleteConfirm.referenceId} deleted`);
      setDeleteConfirm(null);
      setSelectedSub(null);
      fetchSubmissions();
    } catch {
      toast.error('Failed to delete submission');
    } finally {
      setDeleting(false);
    }
  };

  const exportCSV = async () => {
    try {
      toast.loading('Preparing export…', { id: 'export' });
      const params = new URLSearchParams({ page: '1', limit: '100000' });
      Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
      const res = await fetch(`/api/admin/submissions?${params}`, { credentials: 'include' });
      const data = await res.json();
      const all: Submission[] = data.submissions || [];
      const baseUrl = window.location.origin;
      // documentUrl may be a full https:// URL (Firebase Storage) or a legacy /uploads/… path
      const resolveDocUrl = (url: string | null | undefined) => {
        if (!url) return '';
        return url.startsWith('http') ? url : `${baseUrl}${url}`;
      };

      // Collect resolved document URLs in parallel with rows so we can attach
      // them as proper Excel hyperlinks after the sheet is built.
      const docUrls: string[] = [];

      const rows = all.map((s) => {
        const docUrl = resolveDocUrl(s.documentUrl);
        docUrls.push(docUrl);
        return {
          'Reference ID':       s.referenceId,
          'Retailer ID':        s.retailer.retailerId,
          'Reward Tier (Slab)': s.retailer.slab.name,
          'Mobile':             s.retailer.mobile,
          'Owner Name':         s.retailer.ownerName || '',
          'CSO':                s.retailer.cso || '',
          'CSO Phone Number':   s.retailer.csoPhone || '',
          'Gift Selected':      s.gift.name,
          "Recipient's Name":   s.storeName,
          'Address Line 1':     s.addressLine1,
          'Address Line 2':     s.addressLine2 || '',
          'City':               s.city,
          'State':              s.state,
          'Pincode':            s.pincode,
          'Landmark':           s.landmark || '',
          'Address Edited':     s.detailsEdited ? 'Yes' : 'No',
          'Document Type':      s.documentType || '',
          // Display text is short — the real URL is attached as a hyperlink below
          'Document Link':      docUrl ? 'Open Document' : '',
          'Submitted At':       new Date(s.submittedAt).toLocaleString('en-IN'),
          'WhatsApp Sent':      s.whatsappSent ? 'Yes' : 'No',
          'WhatsApp Sent At':   s.whatsappSentAt ? new Date(s.whatsappSentAt).toLocaleString('en-IN') : '',
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);

      // Replace Document Link cells with =HYPERLINK() formula cells.
      // SheetJS CE does not support the .l hyperlink property (Pro only),
      // but it does write formula cells — Excel renders =HYPERLINK() as a
      // clickable blue link without any copy-paste quoting issues.
      const sheetRange = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      let docLinkCol = -1;
      for (let col = sheetRange.s.c; col <= sheetRange.e.c; col++) {
        const headerCell = ws[XLSX.utils.encode_cell({ r: 0, c: col })];
        if (headerCell?.v === 'Document Link') { docLinkCol = col; break; }
      }
      if (docLinkCol >= 0) {
        docUrls.forEach((url, i) => {
          if (!url) return;
          const cellAddr = XLSX.utils.encode_cell({ r: i + 1, c: docLinkCol });
          // Escape any double-quotes in the URL (shouldn't happen but be safe)
          const safeUrl = url.replace(/"/g, '%22');
          ws[cellAddr] = { t: 'f', f: `HYPERLINK("${safeUrl}","Open Document")` };
        });
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Submissions');
      const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbOut], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `submissions-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${all.length} submissions`, { id: 'export' });
    } catch {
      toast.error('Export failed', { id: 'export' });
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Submissions ({total})</h1>
        <button onClick={exportCSV} className="px-4 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50">
          Export Excel
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 mb-4 flex flex-wrap gap-3">
        <select value={filters.slabId} onChange={(e) => setFilters({ ...filters, slabId: e.target.value })}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E3000F]">
          <option value="">All Slabs</option>
          {slabs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={filters.giftId} onChange={(e) => setFilters({ ...filters, giftId: e.target.value })}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E3000F]">
          <option value="">All Gifts</option>
          {gifts.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <input value={filters.city} onChange={(e) => setFilters({ ...filters, city: e.target.value })}
          placeholder="Filter by city" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E3000F]" />
        <select value={filters.detailsEdited} onChange={(e) => setFilters({ ...filters, detailsEdited: e.target.value })}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E3000F]">
          <option value="">All</option>
          <option value="true">Details Edited</option>
          <option value="false">Not Edited</option>
        </select>
        <input type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E3000F]" />
        <input type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E3000F]" />
        <button onClick={() => setFilters({ slabId: '', giftId: '', city: '', state: '', detailsEdited: '', dateFrom: '', dateTo: '' })}
          className="text-sm text-gray-500 underline">Clear</button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Ref ID</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Store</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Gift</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Slab</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">City</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Edited</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">WhatsApp</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={9} className="text-center py-8 text-gray-400">Loading...</td></tr>
              ) : submissions.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-8 text-gray-400">No submissions found</td></tr>
              ) : submissions.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedSub(s)}>
                  <td className="px-4 py-3 font-mono text-xs font-bold text-[#E3000F]">{s.referenceId}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{s.storeName}</p>
                    <p className="text-gray-400 text-xs">{s.retailer.mobile}</p>
                  </td>
                  <td className="px-4 py-3">{s.gift.name}</td>
                  <td className="px-4 py-3">{s.retailer.slab.name}</td>
                  <td className="px-4 py-3">{s.city}</td>
                  <td className="px-4 py-3">
                    {s.detailsEdited
                      ? <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">Yes</span>
                      : <span className="text-gray-400 text-xs">No</span>}
                  </td>
                  <td className="px-4 py-3">
                    {s.whatsappSent
                      ? <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">Sent</span>
                      : <span className="text-gray-400 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(s.submittedAt).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {isSuperAdmin && (
                        <>
                          <button
                            onClick={(e) => openEdit(s, e)}
                            className="px-2 py-1 text-xs rounded bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirm(s); }}
                            className="px-2 py-1 text-xs rounded bg-red-50 text-red-600 hover:bg-red-100 font-medium"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t flex justify-between items-center">
          <p className="text-sm text-gray-500">Showing {Math.min((page - 1) * limit + 1, total)}–{Math.min(page * limit, total)} of {total}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40">Prev</button>
            <button onClick={() => setPage(p => p + 1)} disabled={page * limit >= total}
              className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40">Next</button>
          </div>
        </div>
      </div>

      {/* ── Detail Modal ── */}
      {selectedSub && !editingSub && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">Submission Details</h3>
              <div className="flex gap-2 items-center">
                {isSuperAdmin && (
                  <>
                    <button
                      onClick={(e) => openEdit(selectedSub, e)}
                      className="px-3 py-1.5 text-sm rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(selectedSub)}
                      className="px-3 py-1.5 text-sm rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-medium"
                    >
                      Delete
                    </button>
                  </>
                )}
                <button onClick={() => setSelectedSub(null)} className="text-gray-400 hover:text-gray-600 ml-1">✕</button>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              {[
                ['Reference ID', selectedSub.referenceId],
                ['Store Name', selectedSub.storeName],
                ['Owner', selectedSub.ownerName],
                ['Gift', selectedSub.gift.name],
                ['Slab', selectedSub.retailer.slab.name],
                ['Address', `${selectedSub.addressLine1}${selectedSub.addressLine2 ? ', ' + selectedSub.addressLine2 : ''}`],
                ['City', selectedSub.city],
                ['State', selectedSub.state],
                ['Pincode', selectedSub.pincode],
                ['Landmark', selectedSub.landmark || '—'],
                ['Mobile', selectedSub.retailer.mobile],
                ['Alternate Mobile', selectedSub.alternateMobile || '—'],
                ['GST', selectedSub.gstNumber || '—'],
                ['Details Edited', selectedSub.detailsEdited ? 'Yes' : 'No'],
                ['WhatsApp Sent', selectedSub.whatsappSent ? 'Yes' : 'No'],
                ['Submitted', new Date(selectedSub.submittedAt).toLocaleString('en-IN')],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-3">
                  <span className="text-gray-400 w-36 flex-none">{label}</span>
                  <span className="font-medium text-gray-800">{value}</span>
                </div>
              ))}
              {selectedSub.documentUrl && (
                <div className="flex gap-3">
                  <span className="text-gray-400 w-36 flex-none">Document</span>
                  <a href={selectedSub.documentUrl} target="_blank" rel="noopener noreferrer"
                    className="text-blue-600 underline text-sm">{selectedSub.documentType || 'View'}</a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editingSub && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">Edit Submission</h3>
              <button onClick={() => setEditingSub(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="space-y-3 text-sm">
              {/* Gift */}
              <div>
                <label className="block text-gray-500 mb-1">Gift</label>
                <select value={editForm.giftId} onChange={(e) => setEditForm({ ...editForm, giftId: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#E3000F]">
                  {gifts.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              {[
                { key: 'storeName', label: "Store / Recipient's Name" },
                { key: 'ownerName', label: 'Owner Name' },
                { key: 'addressLine1', label: 'Address Line 1' },
                { key: 'addressLine2', label: 'Address Line 2' },
                { key: 'city', label: 'City' },
                { key: 'state', label: 'State' },
                { key: 'pincode', label: 'Pincode' },
                { key: 'landmark', label: 'Landmark' },
                { key: 'gstNumber', label: 'GST Number' },
                { key: 'alternateMobile', label: 'Alternate Mobile' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-gray-500 mb-1">{label}</label>
                  <input
                    value={editForm[key as keyof typeof editForm]}
                    onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#E3000F]"
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditingSub(null)}
                className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium">
                Cancel
              </button>
              <button onClick={handleSaveEdit} disabled={saving}
                className="flex-1 bg-[#E3000F] text-white py-2.5 rounded-xl text-sm font-bold disabled:opacity-60">
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <div className="text-center mb-4">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-3xl">🗑️</span>
              </div>
              <h3 className="text-lg font-bold text-gray-800">Delete Submission?</h3>
              <p className="text-sm text-gray-500 mt-1">
                This will permanently delete <span className="font-bold text-gray-800">{deleteConfirm.referenceId}</span>.
                This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-xl text-sm font-bold disabled:opacity-60">
                {deleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
