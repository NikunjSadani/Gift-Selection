'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

interface Submission {
  id: string;
  referenceId: string;
  storeName: string;
  ownerName: string;
  city: string;
  state: string;
  pincode: string;
  detailsEdited: boolean;
  whatsappSent: boolean;
  submittedAt: string;
  retailer: { slab: { name: string }; mobile: string };
  gift: { name: string };
}

interface Slab {
  id: string;
  name: string;
}

interface Gift {
  id: string;
  name: string;
}

export default function SubmissionsPage() {
  const router = useRouter();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [slabs, setSlabs] = useState<Slab[]>([]);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedSub, setSelectedSub] = useState<Submission | null>(null);
  const limit = 20;

  const [filters, setFilters] = useState({
    slabId: '', giftId: '', city: '', state: '', detailsEdited: '', dateFrom: '', dateTo: '',
  });

  const fetchSubmissions = async () => {
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
  };

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/slabs', { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/admin/gifts', { credentials: 'include' }).then((r) => r.json()),
    ]).then(([sData, gData]) => {
      setSlabs(sData.slabs || []);
      setGifts(gData.gifts || []);
    });
  }, []);

  useEffect(() => { fetchSubmissions(); }, [page, filters]);

  const exportCSV = () => {
    const rows = submissions.map((s) => ({
      'Reference ID': s.referenceId,
      'Store Name': s.storeName,
      'Owner': s.ownerName,
      'City': s.city,
      'State': s.state,
      'Pincode': s.pincode,
      'Slab': s.retailer.slab.name,
      'Gift': s.gift.name,
      'Mobile': s.retailer.mobile,
      'Details Edited': s.detailsEdited ? 'Yes' : 'No',
      'WhatsApp Sent': s.whatsappSent ? 'Yes' : 'No',
      'Submitted At': new Date(s.submittedAt).toLocaleString('en-IN'),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Submissions');
    XLSX.writeFile(wb, `submissions-${new Date().toISOString().split('T')[0]}.xlsx`);
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
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={8} className="text-center py-8 text-gray-400">Loading...</td></tr>
              ) : submissions.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-gray-400">No submissions found</td></tr>
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
                    {s.detailsEdited ? <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">Yes</span> : <span className="text-gray-400 text-xs">No</span>}
                  </td>
                  <td className="px-4 py-3">
                    {s.whatsappSent ? <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">Sent</span> : <span className="text-gray-400 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(s.submittedAt).toLocaleDateString('en-IN')}</td>
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

      {/* Detail Modal */}
      {selectedSub && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">Submission Details</h3>
              <button onClick={() => setSelectedSub(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-3 text-sm">
              {[
                ['Reference ID', selectedSub.referenceId],
                ['Store Name', selectedSub.storeName],
                ['Owner', selectedSub.ownerName],
                ['Gift', selectedSub.gift.name],
                ['Slab', selectedSub.retailer.slab.name],
                ['City', selectedSub.city],
                ['State', selectedSub.state],
                ['Pincode', selectedSub.pincode],
                ['Mobile', selectedSub.retailer.mobile],
                ['Details Edited', selectedSub.detailsEdited ? 'Yes' : 'No'],
                ['WhatsApp Sent', selectedSub.whatsappSent ? 'Yes' : 'No'],
                ['Submitted', new Date(selectedSub.submittedAt).toLocaleString('en-IN')],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-3">
                  <span className="text-gray-400 w-36 flex-none">{label}</span>
                  <span className="font-medium text-gray-800">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
