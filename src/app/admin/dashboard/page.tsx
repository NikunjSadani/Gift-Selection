'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface DashboardData {
  totalRetailers: number;
  totalLogins: number;
  totalSubmissions: number;
  pendingCount: number;
  notStarted: number;
  slabWise: { id: string; name: string; totalRetailers: number; submissions: number }[];
  giftWise: { id: string; name: string; count: number }[];
  whatsappSuccessRate: number;
}

const KPICard = ({ label, value, color }: { label: string; value: number | string; color: string }) => (
  <div className={`bg-white rounded-2xl p-5 border-l-4 ${color} shadow-sm`}>
    <p className="text-gray-500 text-sm">{label}</p>
    <p className="text-3xl font-bold text-gray-800 mt-1">{value}</p>
  </div>
);

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/dashboard', { credentials: 'include' })
      .then((r) => {
        if (r.status === 401) { router.replace('/admin/login'); return null; }
        return r.json();
      })
      .then((d) => { if (d) setData(d); })
      .catch(() => toast.error('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#E3000F]" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h1>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard label="Total Retailers" value={data.totalRetailers} color="border-blue-500" />
        <KPICard label="Total Submissions" value={data.totalSubmissions} color="border-green-500" />
        <KPICard label="Pending (In Progress)" value={data.pendingCount} color="border-yellow-500" />
        <KPICard label="Not Started" value={data.notStarted} color="border-gray-400" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Slab wise */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h2 className="font-bold text-gray-800 mb-4">Slab-wise Participation</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b">
                <th className="text-left pb-2">Slab</th>
                <th className="text-right pb-2">Retailers</th>
                <th className="text-right pb-2">Submitted</th>
                <th className="text-right pb-2">Rate</th>
              </tr>
            </thead>
            <tbody>
              {data.slabWise.map((s) => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="py-2 font-medium">{s.name}</td>
                  <td className="text-right text-gray-600">{s.totalRetailers}</td>
                  <td className="text-right text-gray-600">{s.submissions}</td>
                  <td className="text-right text-gray-600">
                    {s.totalRetailers > 0 ? Math.round((s.submissions / s.totalRetailers) * 100) : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Gift wise */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h2 className="font-bold text-gray-800 mb-4">Gift Selection Count</h2>
          <div className="space-y-3">
            {data.giftWise.sort((a, b) => b.count - a.count).map((g) => (
              <div key={g.id} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700 truncate">{g.name}</span>
                    <span className="text-gray-500 ml-2">{g.count}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#E3000F] rounded-full"
                      style={{
                        width: data.totalSubmissions > 0 ? `${(g.count / data.totalSubmissions) * 100}%` : '0%',
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
            {data.giftWise.length === 0 && <p className="text-gray-400 text-sm">No submissions yet</p>}
          </div>
        </div>
      </div>

      {/* WhatsApp rate */}
      <div className="mt-4 bg-white rounded-2xl p-5 shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="font-bold text-gray-800">WhatsApp Confirmation Rate</h2>
            <p className="text-gray-500 text-sm mt-0.5">% of submissions with WhatsApp sent</p>
          </div>
          <div className="text-3xl font-bold text-green-600">{data.whatsappSuccessRate}%</div>
        </div>
      </div>
    </div>
  );
}
