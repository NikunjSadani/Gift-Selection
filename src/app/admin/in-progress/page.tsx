/* eslint-disable react-hooks/purity */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { CHANGE_WINDOW_MS } from '@/lib/gift-window';

interface InProgressEntry {
  id: string;
  retailerId: string;
  name: string;
  mobile: string;
  slab: string;
  giftId: string | null;
  giftSelected: string;
  giftConfirmed: boolean;
  giftSelectedAt: string | null;
  step: string;
  lastActivity: string;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return 'just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function windowRemaining(giftSelectedAt: string | null): { label: string; color: string } {
  if (!giftSelectedAt) return { label: '—', color: 'text-gray-400' };
  const ms = CHANGE_WINDOW_MS - (Date.now() - new Date(giftSelectedAt).getTime());
  if (ms <= 0) return { label: 'Expired', color: 'text-gray-400' };
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const label = h === 0 ? `${m}m left` : `${h}h ${m}m left`;
  return { label, color: ms < 3600000 ? 'text-red-500 font-semibold' : 'text-amber-600' };
}

export default function InProgressPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<InProgressEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [resetting, setResetting] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/in-progress', { credentials: 'include' });
      if (res.status === 401) { router.replace('/admin/login'); return; }
      const data = await res.json();
      setEntries(data.inProgress || []);
      setTotal(data.total || 0);
    } catch {
      toast.error('Failed to load');
    } finally {
      setLoading(false);
    }
  }, [router]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = entries.filter((e) =>
    !search ||
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.mobile.includes(search) ||
    e.retailerId.toLowerCase().includes(search.toLowerCase()),
  );

  const handleResetGift = async (entry: InProgressEntry) => {
    if (!confirm(`Reset gift selection for ${entry.name}? They will be able to select a new gift.`)) return;
    setResetting(entry.id);
    try {
      const res = await fetch(`/api/admin/in-progress?draftId=${entry.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(`Gift reset for ${entry.name}`);
      fetchData();
    } catch {
      toast.error('Failed to reset gift');
    } finally {
      setResetting(null);
    }
  };

  const exportExcel = () => {
    const rows = filtered.map((e) => ({
      'Retailer ID':     e.retailerId,
      'Name':            e.name,
      'Mobile':          e.mobile,
      'Slab':            e.slab,
      'Gift Selected':   e.giftSelected,
      'Status':          e.giftConfirmed ? 'Confirmed' : 'Pending Confirmation',
      'First Selected':  e.giftSelectedAt ? new Date(e.giftSelectedAt).toLocaleString('en-IN') : '—',
      'Window':          e.giftConfirmed ? 'Locked (confirmed)' : windowRemaining(e.giftSelectedAt).label,
      'Last Activity':   new Date(e.lastActivity).toLocaleString('en-IN'),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'In Progress');
    const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbOut], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `in-progress-${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">In Progress</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Retailers who selected a gift but haven&apos;t submitted yet
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <button
            onClick={fetchData}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            title="Refresh"
          >
            🔄
          </button>
          <button
            onClick={exportExcel}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Export Excel
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <p className="text-sm text-gray-500">Total In Progress</p>
          <p className="text-3xl font-black text-[#E3000F] mt-1">{total}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <p className="text-sm text-gray-500">Active in last 24h</p>
          <p className="text-3xl font-black text-amber-500 mt-1">
            {entries.filter((e) => Date.now() - new Date(e.lastActivity).getTime() < 86400000).length}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, mobile or retailer ID…"
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#E3000F]"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Retailer</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Slab</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Gift Selected</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">24h Window</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Last Activity</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-10">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[#E3000F]" />
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-gray-400">
                  {search ? 'No results match your search' : '🎉 No pending submissions — everyone has submitted!'}
                </td>
              </tr>
            ) : filtered.map((e) => {
              const win = windowRemaining(e.giftSelectedAt);
              const now = Date.now();
              const lastActivityMs = new Date(e.lastActivity).getTime();
              return (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-800">{e.name}</p>
                  <p className="text-xs text-gray-400">{e.mobile} · {e.retailerId}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                    {e.slab}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1.5">
                    <span className="text-base">🎁</span>
                    <span className="text-gray-700">{e.giftSelected}</span>
                  </span>
                </td>
                <td className="px-4 py-3">
                  {e.giftConfirmed ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                      ✅ Confirmed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                      ⏳ Pending
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {e.giftConfirmed ? (
                    <span className="text-xs text-gray-400">Locked (confirmed)</span>
                  ) : (
                    <span className={`text-xs ${win.color}`}>{win.label}</span>
                  )}
                  {e.giftSelectedAt && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Since {new Date(e.giftSelectedAt).toLocaleDateString('en-IN')}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium ${
                    now - lastActivityMs < 3600000
                      ? 'text-green-600'
                      : now - lastActivityMs < 86400000
                      ? 'text-amber-600'
                      : 'text-gray-400'
                  }`}>
                    {timeAgo(e.lastActivity)}
                  </span>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(e.lastActivity).toLocaleDateString('en-IN')}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleResetGift(e)}
                    disabled={resetting === e.id}
                    className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {resetting === e.id ? 'Resetting…' : 'Reset Gift'}
                  </button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
