'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface OutletOption {
  id: string;
  retailerId: string;
  slabName: string;
  hasSubmission: boolean;
}

export default function SelectOutletPage() {
  const router = useRouter();
  const [outlets, setOutlets] = useState<OutletOption[]>([]);
  const [selecting, setSelecting] = useState<string | null>(null);

  useEffect(() => {
    // Primary: sessionStorage (set by login page after OTP verify)
    const stored = sessionStorage.getItem('kw_outlets');
    if (stored) {
      try {
        setOutlets(JSON.parse(stored));
        return;
      } catch { /* fall through to API */ }
    }

    // Fallback: fetch from API using existing retailer_token
    // (handles browser back-button, refresh, or navigating here from within the app)
    fetch('/api/retailer/outlets', { credentials: 'include' })
      .then((r) => {
        if (!r.ok) {
          // 401 = session expired (outlet_selection_token timed out, no retailer_token yet)
          toast.error('Session expired. Please log in again.');
          router.replace('/');
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (!data) return; // already redirected above
        if (data.outlets.length < 2) {
          // Single-outlet user — home will redirect them to /gift or /confirmation
          router.replace('/');
          return;
        }
        setOutlets(data.outlets);
      })
      .catch(() => {
        toast.error('Network error. Please try again.');
        router.replace('/');
      });
  }, [router]);

  const handleSelect = async (outlet: OutletOption) => {
    setSelecting(outlet.id);
    try {
      const res = await fetch('/api/auth/select-outlet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ retailerId: outlet.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'session_expired') {
          sessionStorage.removeItem('kw_outlets');
          toast.error('Session expired. Please log in again.');
          router.replace('/');
        } else {
          toast.error('Could not select outlet. Please try again.');
        }
        return;
      }
      sessionStorage.removeItem('kw_outlets');
      router.replace(data.hasSubmission ? '/confirmation' : '/gift');
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setSelecting(null);
    }
  };

  if (outlets.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#E3000F]" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mt-8 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Select Your Outlet</h1>
        <p className="text-gray-500 mt-1 text-sm">
          You have {outlets.length} outlets. Tap one to continue.
        </p>
      </div>

      <div className="space-y-3">
        {outlets.map((outlet) => (
          <button
            key={outlet.id}
            onClick={() => handleSelect(outlet)}
            disabled={!!selecting}
            className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4 text-left active:scale-[0.98] transition-all hover:shadow-md disabled:opacity-60"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-gray-900 text-base">{outlet.retailerId}</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  Reward Tier:{' '}
                  <span className="font-semibold text-[#E3000F]">{outlet.slabName}</span>
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                {outlet.hasSubmission ? (
                  <span className="text-xs bg-green-100 text-green-700 font-medium px-2.5 py-0.5 rounded-full">
                    ✓ Submitted
                  </span>
                ) : (
                  <span className="text-xs bg-amber-50 text-amber-700 font-medium px-2.5 py-0.5 rounded-full">
                    Pending
                  </span>
                )}
                {selecting === outlet.id ? (
                  <div className="w-5 h-5 border-2 border-[#E3000F] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="text-gray-300 text-2xl leading-none">›</span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
