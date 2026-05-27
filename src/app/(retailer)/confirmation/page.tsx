'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';

interface Gift {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  mrp: number | null;
  showMrp: boolean;
}

interface Submission {
  referenceId: string;
  storeName: string;
  submittedAt: string;
  giftConfirmedAt: string | null;
  gift: { id: string; name: string; imageUrl: string | null };
}

const GRADIENT_COLORS = [
  'from-red-400 to-orange-500',
  'from-blue-400 to-purple-500',
  'from-green-400 to-teal-500',
  'from-yellow-400 to-orange-400',
  'from-pink-400 to-rose-500',
  'from-indigo-400 to-blue-500',
];

function formatCountdown(submittedAt: string): { label: string; urgent: boolean; expired: boolean } {
  const ms = 86400000 - (Date.now() - new Date(submittedAt).getTime());
  if (ms <= 0) return { label: 'Window closed', urgent: false, expired: true };
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const urgent = ms < 3600000;
  if (h === 0) return { label: `${m}m left to change`, urgent, expired: false };
  return { label: `${h}h ${m}m left to change`, urgent, expired: false };
}

export default function ConfirmationPage() {
  const router = useRouter();
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);

  // Gift change state
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [changeSheetOpen, setChangeSheetOpen] = useState(false);
  const [modalGift, setModalGift] = useState<Gift | null>(null);
  const [changingGift, setChangingGift] = useState(false);

  // Countdown ticker
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/retailer/me', { credentials: 'include' });
        if (cancelled) return;
        if (!res.ok) { router.replace('/'); return; }
        const { retailer } = await res.json();
        if (cancelled) return;
        if (!retailer.submission) { router.replace('/gift'); return; }
        setSubmission(retailer.submission);
      } catch {
        if (!cancelled) router.replace('/');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  // Load gifts lazily when change sheet is first opened
  const openChangeSheet = async () => {
    if (gifts.length === 0) {
      try {
        const res = await fetch('/api/gifts', { credentials: 'include' });
        const data = await res.json();
        setGifts(data.gifts || []);
      } catch {
        toast.error('Could not load gifts. Please try again.');
        return;
      }
    }
    setChangeSheetOpen(true);
  };

  const handleConfirmChange = async (gift: Gift) => {
    if (!submission) return;
    setChangingGift(true);
    try {
      const res = await fetch('/api/submit', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ giftId: gift.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'window_expired') {
          toast.error('The 24-hour change window has closed.');
        } else {
          throw new Error(data.error);
        }
        return;
      }
      // Update local state
      setSubmission((prev) => prev ? { ...prev, gift: { id: gift.id, name: gift.name, imageUrl: gift.imageUrl } } : prev);
      setModalGift(null);
      setChangeSheetOpen(false);
      toast.success(`Gift changed to ${gift.name}!`);
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.5 },
        colors: ['#E3000F', '#FFD200', '#ffffff'] });
    } catch {
      toast.error('Could not change gift. Please try again.');
    } finally {
      setChangingGift(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#E3000F]" />
      </div>
    );
  }

  if (!submission) return null;

  const submittedDate = new Date(submission.submittedAt);
  // The 24h clock starts when the retailer clicked "Confirm My Gift Selection" (giftConfirmedAt).
  // Fall back to submittedAt for older records that don't have giftConfirmedAt.
  const clockStart = submission.giftConfirmedAt ?? submission.submittedAt;
  const countdown = formatCountdown(clockStart);

  return (
    <>
      <div className="p-6 flex flex-col items-center text-center min-h-[80vh] justify-center">
        {/* Success icon */}
        <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mb-6 shadow-lg">
          <svg className="w-12 h-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          Thank you, {submission.storeName}!
        </h1>
        <p className="text-gray-500 mb-6">Your gift selection has been submitted successfully.</p>

        {/* Reference card */}
        <div className="bg-gradient-to-br from-[#E3000F] to-red-700 rounded-2xl p-6 w-full mb-4 text-white shadow-xl">
          <p className="text-white/80 text-sm mb-1">Reference ID</p>
          <p className="text-3xl font-black tracking-wider">{submission.referenceId}</p>
          <div className="mt-4 pt-4 border-t border-white/20">
            <p className="text-white/80 text-xs">Selected Gift</p>
            <p className="font-bold text-lg">{submission.gift.name}</p>
          </div>
        </div>

        {/* Change gift section */}
        {!countdown.expired ? (
          <div className="w-full mb-4">
            <button
              onClick={openChangeSheet}
              className="w-full border-2 border-[#E3000F] text-[#E3000F] font-bold py-3.5 rounded-2xl text-base active:scale-95 transition-transform"
            >
              🔄 Change Gift Selection
            </button>
            <div className={`mt-2.5 rounded-full px-4 py-1.5 flex items-center justify-center gap-1.5 text-xs font-medium ${
              countdown.urgent
                ? 'bg-red-50 border border-red-200 text-red-600'
                : 'bg-amber-50 border border-amber-200 text-amber-700'
            }`}>
              <span>{countdown.urgent ? '⚠️' : '🕐'}</span>
              <span>{countdown.label}</span>
            </div>
          </div>
        ) : (
          <div className="w-full mb-4 bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-500 flex items-center gap-2">
            <span>🔒</span>
            <span>Gift change window has closed (24h passed)</span>
          </div>
        )}

        {/* Submitted on */}
        <div className="bg-gray-50 rounded-xl p-4 w-full mb-6">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Submitted on</p>
          <p className="font-semibold text-gray-700">
            {submittedDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
            {' '}at{' '}
            {submittedDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        <p className="text-xs text-gray-400 mt-2">
          Keep your Reference ID safe. You may need it for any queries.
        </p>
      </div>

      {/* ── Change Gift Bottom Sheet ── */}
      {changeSheetOpen && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/60"
          onClick={() => { if (!modalGift) setChangeSheetOpen(false); }}
        >
          <div
            className="bg-white rounded-t-3xl w-full max-w-lg max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sheet header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Change Your Gift</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Currently: <span className="font-medium text-gray-700">{submission.gift.name}</span>
                </p>
              </div>
              <button
                onClick={() => setChangeSheetOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ✕
              </button>
            </div>

            {/* Countdown inside sheet */}
            {!countdown.expired && (
              <div className={`mx-5 mt-3 rounded-lg px-3 py-2 text-xs font-medium flex items-center gap-2 ${
                countdown.urgent
                  ? 'bg-red-50 text-red-600'
                  : 'bg-amber-50 text-amber-700'
              }`}>
                <span>{countdown.urgent ? '⚠️' : '⏱️'}</span>
                <span>{countdown.label}</span>
              </div>
            )}

            {/* Gift list */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
              {gifts.map((gift, i) => {
                const isCurrent = submission.gift.id === gift.id;
                return (
                  <div
                    key={gift.id}
                    onClick={() => !isCurrent && setModalGift(gift)}
                    className={`flex gap-3 bg-white rounded-2xl shadow-sm overflow-hidden border transition-all ${
                      isCurrent
                        ? 'border-green-400 bg-green-50 cursor-default'
                        : 'border-gray-100 cursor-pointer active:scale-[0.98] hover:shadow-md'
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className={`w-24 h-20 flex-none relative ${
                      gift.imageUrl ? 'bg-gray-100' : `bg-gradient-to-br ${GRADIENT_COLORS[i % GRADIENT_COLORS.length]}`
                    }`}>
                      {gift.imageUrl ? (
                        <Image src={gift.imageUrl} alt={gift.name} fill className="object-cover" sizes="96px" />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <span className="text-3xl">🎁</span>
                        </div>
                      )}
                      {isCurrent && (
                        <div className="absolute top-1 left-1 bg-green-500 rounded-full w-5 h-5 flex items-center justify-center">
                          <span className="text-white text-xs font-bold">✓</span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 py-3 pr-3 flex flex-col justify-center min-w-0">
                      <h3 className={`font-bold text-sm leading-tight ${isCurrent ? 'text-green-700' : 'text-gray-800'}`}>
                        {gift.name}
                      </h3>
                      <p className="text-gray-500 text-xs mt-0.5 line-clamp-2">{gift.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {gift.showMrp && gift.mrp && (
                          <span className="text-xs font-bold bg-[#FFD200] text-gray-900 px-2 py-0.5 rounded-full">
                            ₹{gift.mrp.toLocaleString('en-IN')}
                          </span>
                        )}
                        {isCurrent ? (
                          <span className="text-xs text-green-600 font-medium">Current selection</span>
                        ) : (
                          <span className="text-xs text-[#E3000F] font-medium">Tap to select →</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Gift Detail Modal (above the sheet) ── */}
      {modalGift && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70"
          onClick={() => setModalGift(null)}
        >
          <div
            className="bg-white rounded-t-3xl w-full max-w-lg max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Hero image */}
            <div className={`relative h-52 flex-none ${
              modalGift.imageUrl ? 'bg-gray-100' : `bg-gradient-to-br ${GRADIENT_COLORS[gifts.findIndex((g) => g.id === modalGift.id) % GRADIENT_COLORS.length]}`
            }`}>
              {modalGift.imageUrl ? (
                <Image src={modalGift.imageUrl} alt={modalGift.name} fill className="object-cover rounded-t-3xl" sizes="100vw" />
              ) : (
                <div className="flex items-center justify-center h-full rounded-t-3xl">
                  <span className="text-9xl">🎁</span>
                </div>
              )}
              <button
                onClick={() => setModalGift(null)}
                className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white rounded-full w-9 h-9 flex items-center justify-center text-lg font-bold transition-colors"
              >
                ✕
              </button>
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-1 bg-white/50 rounded-full" />
            </div>

            {/* Content */}
            <div className="p-5 pb-8">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-xl font-bold text-gray-800">{modalGift.name}</h2>
                {modalGift.showMrp && modalGift.mrp && (
                  <span className="flex-none bg-[#FFD200] text-gray-900 text-sm font-bold px-3 py-1 rounded-full">
                    ₹{modalGift.mrp.toLocaleString('en-IN')}
                  </span>
                )}
              </div>
              <p className="text-gray-600 text-sm mt-3 leading-relaxed">{modalGift.description}</p>

              <button
                onClick={() => handleConfirmChange(modalGift)}
                disabled={changingGift}
                className="w-full mt-6 bg-[#E3000F] hover:bg-[#c0000d] text-white font-bold py-4 rounded-2xl text-base transition-all shadow-md active:scale-95 disabled:opacity-60"
              >
                {changingGift ? 'Changing gift…' : `Switch to ${modalGift.name}`}
              </button>
              <button
                onClick={() => setModalGift(null)}
                className="w-full mt-3 text-gray-500 text-sm font-medium py-2"
              >
                Cancel — go back
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
