'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import Image from 'next/image';

interface Gift {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  mrp: number | null;
  showMrp: boolean;
}

interface FormValues {
  storeName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  landmark: string;
}

const GRADIENT_COLORS = [
  'from-red-400 to-orange-500',
  'from-blue-400 to-purple-500',
  'from-green-400 to-teal-500',
  'from-yellow-400 to-orange-400',
  'from-pink-400 to-rose-500',
  'from-indigo-400 to-blue-500',
];

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh',
  'Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka',
  'Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram',
  'Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana',
  'Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
  'Delhi','Jammu & Kashmir','Ladakh','Puducherry','Chandigarh',
  'Andaman and Nicobar Islands','Dadra and Nagar Haveli and Daman and Diu',
  'Lakshadweep',
];

function formatCountdown(isoStr: string): { label: string; urgent: boolean; expired: boolean } {
  const ms = 86400000 - (Date.now() - new Date(isoStr).getTime());
  if (ms <= 0) return { label: 'Change window closed', urgent: false, expired: true };
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const urgent = ms < 3600000;
  if (h === 0) return { label: `${m}m left to change gift`, urgent, expired: false };
  return { label: `${h}h ${m}m left to change gift`, urgent, expired: false };
}

export default function GiftPage() {
  const router = useRouter();
  const formRef = useRef<HTMLDivElement>(null);
  const hasFetched = useRef(false);

  const [gifts, setGifts] = useState<Gift[]>([]);
  const [slab, setSlab] = useState<{ name: string; internalCode: string } | null>(null);
  const [retailerMobile, setRetailerMobile] = useState('');
  const [loading, setLoading] = useState(true);
  const [hasMultipleOutlets, setHasMultipleOutlets] = useState(false);

  // Gift selection
  const [selectedGift, setSelectedGift] = useState<Gift | null>(null);
  const [giftConfirmed, setGiftConfirmed] = useState(false);
  // giftConfirmedAt: the moment "Confirm My Gift Selection" was clicked — this is the ONE clock
  const [giftConfirmedAt, setGiftConfirmedAt] = useState<string | null>(null);
  const [confirmingGift, setConfirmingGift] = useState(false);

  // Modals / sheets
  const [modalGift, setModalGift] = useState<Gift | null>(null);       // pre-confirm detail view
  const [changeSheetOpen, setChangeSheetOpen] = useState(false);       // post-confirm change sheet
  const [changeModalGift, setChangeModalGift] = useState<Gift | null>(null); // detail in change sheet
  const [changingGift, setChangingGift] = useState(false);

  // Form
  const [originalData, setOriginalData] = useState<Partial<FormValues>>({});
  const [detailsEdited, setDetailsEdited] = useState(false);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [documentType, setDocumentType] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Minute ticker to keep countdown live
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!giftConfirmedAt) return;
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, [giftConfirmedAt]);

  const { register, watch, getValues, setValue, handleSubmit, formState: { errors } } = useForm<FormValues>();

  // ── Derived lock state ────────────────────────────────────────────────────
  // The clock starts when the retailer clicks "Confirm My Gift Selection".
  // Within 24h: confirmed but can still change.
  // After 24h: fully locked.
  const is24hExpired = giftConfirmedAt
    ? Date.now() - new Date(giftConfirmedAt).getTime() >= 86400000
    : false;
  const isFullyLocked = giftConfirmed && is24hExpired;
  const canChangeAfterConfirm = giftConfirmed && !is24hExpired;
  const countdown = giftConfirmedAt ? formatCountdown(giftConfirmedAt) : null;

  // ── Detect address edits ──────────────────────────────────────────────────
  const watchedValues = watch();
  useEffect(() => {
    if (Object.keys(originalData).length === 0) return;
    const fields = ['storeName', 'addressLine1', 'addressLine2', 'city', 'state', 'pincode'] as const;
    const edited = fields.some((f) => (watchedValues[f] || '') !== (originalData[f] || ''));
    setDetailsEdited(edited);
  }, [watchedValues, originalData]);

  // ── Auto-save draft ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedGift) return;
    const giftId = selectedGift.id;
    const timer = setTimeout(async () => {
      try {
        await fetch('/api/draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ step: 'details', giftId, formData: getValues() }),
        });
      } catch { /* silent */ }
    }, 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedValues, selectedGift]);

  // ── Initial data load ─────────────────────────────────────────────────────
  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    const load = async () => {
      try {
        const [giftsRes, meRes, outletsRes] = await Promise.all([
          fetch('/api/gifts', { credentials: 'include' }),
          fetch('/api/retailer/me', { credentials: 'include' }),
          fetch('/api/retailer/outlets', { credentials: 'include' }),
        ]);

        if (!giftsRes.ok) { router.replace('/'); return; }

        const giftList: Gift[] = (await giftsRes.json()).gifts || [];
        setGifts(giftList);

        if (meRes.ok) {
          const { retailer } = await meRes.json();

          if (retailer.slab) setSlab({ name: retailer.slab.name, internalCode: retailer.slab.internalCode });
          if (retailer.mobile) setRetailerMobile(retailer.mobile);

          const prefill: Partial<FormValues> = {
            storeName: retailer.name || '',
            addressLine1: retailer.addressLine1 || '',
            addressLine2: retailer.addressLine2 || '',
            city: retailer.city || '',
            state: retailer.state || '',
            pincode: retailer.pincode || '',
            landmark: retailer.landmark || '',
          };
          setOriginalData({
            storeName: retailer.name || '',
            addressLine1: retailer.addressLine1 || '',
            addressLine2: retailer.addressLine2 || '',
            city: retailer.city || '',
            state: retailer.state || '',
            pincode: retailer.pincode || '',
          });

          if (retailer.draft?.formData) {
            try {
              const raw = retailer.draft.formData;
              const saved = typeof raw === 'string' ? JSON.parse(raw) : raw;
              if (saved && typeof saved === 'object') Object.assign(prefill, saved);
            } catch { /* corrupt */ }
          }
          Object.entries(prefill).forEach(([k, v]) => setValue(k as keyof FormValues, v || ''));

          if (retailer.draft?.giftId) {
            const found = giftList.find((g) => g.id === retailer.draft.giftId);
            if (found) setSelectedGift(found);
          }
          if (retailer.draft?.giftConfirmed) setGiftConfirmed(true);
          // giftSelectedAt on the draft = the confirm-clock timestamp
          if (retailer.draft?.giftSelectedAt) setGiftConfirmedAt(retailer.draft.giftSelectedAt);
        }

        // Multi-outlet: check if owner has more than one active outlet
        if (outletsRes.ok) {
          const { outlets } = await outletsRes.json();
          setHasMultipleOutlets(Array.isArray(outlets) && outlets.length > 1);
        }
      } catch {
        toast.error('Failed to load. Please refresh.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router, setValue]);

  // ── Confetti ──────────────────────────────────────────────────────────────
  const fireConfetti = useCallback(() => {
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.4 },
      colors: ['#E3000F', '#FFD200', '#ffffff', '#ff6b6b', '#ffd93d'] });
    setTimeout(() => {
      confetti({ particleCount: 60, angle: 60, spread: 55, origin: { x: 0, y: 0.5 },
        colors: ['#E3000F', '#FFD200', '#ffffff'] });
      confetti({ particleCount: 60, angle: 120, spread: 55, origin: { x: 1, y: 0.5 },
        colors: ['#E3000F', '#FFD200', '#ffffff'] });
    }, 200);
  }, []);

  // ── Pre-confirm: tap card → open detail modal → select ────────────────────
  const handleSelectGift = async (gift: Gift) => {
    if (giftConfirmed) return; // after confirm use the change sheet instead
    const isNew = selectedGift?.id !== gift.id;
    setSelectedGift(gift);
    setModalGift(null);
    if (isNew) {
      fireConfetti();
      try {
        await fetch('/api/draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ step: 'gift', giftId: gift.id }),
        });
      } catch { /* auto-save will retry */ }
    }
  };

  // ── Confirm gift — this starts the 24h clock ──────────────────────────────
  const handleConfirmGift = async () => {
    if (!selectedGift || giftConfirmed) return;
    setConfirmingGift(true);
    try {
      await fetch('/api/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ step: 'details', giftId: selectedGift.id, giftConfirmed: true }),
      });
      setGiftConfirmed(true);
      setGiftConfirmedAt(new Date().toISOString()); // start the 24h clock locally
      setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    } catch {
      toast.error('Could not confirm gift. Please try again.');
    } finally {
      setConfirmingGift(false);
    }
  };

  // ── Post-confirm: change gift within 24h window ───────────────────────────
  const handleChangeGift = async (gift: Gift) => {
    if (gift.id === selectedGift?.id) { setChangeSheetOpen(false); setChangeModalGift(null); return; }
    setChangingGift(true);
    try {
      await fetch('/api/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        // No giftConfirmed in body — API won't touch giftConfirmed or giftSelectedAt (clock stays)
        body: JSON.stringify({ step: 'details', giftId: gift.id }),
      });
      setSelectedGift(gift);
      setChangeSheetOpen(false);
      setChangeModalGift(null);
      toast.success(`Gift changed to ${gift.name}`);
      fireConfetti();
    } catch {
      toast.error('Could not change gift. Please try again.');
    } finally {
      setChangingGift(false);
    }
  };

  // ── Document upload ───────────────────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('File must be under 5MB'); return; }
    if (!['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'].includes(file.type)) {
      toast.error('Only JPG, PNG, or PDF allowed'); return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', credentials: 'include', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDocumentUrl(data.url);
      toast.success('Document uploaded');
    } catch {
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const onSubmit = async (formData: FormValues) => {
    if (!selectedGift) { toast.error('Please select a gift first'); return; }
    if (detailsEdited && !documentUrl) { toast.error('Please upload a document since you edited your address'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          giftId: selectedGift.id,
          storeName: formData.storeName,
          ownerName: '',
          addressLine1: formData.addressLine1,
          addressLine2: formData.addressLine2,
          city: formData.city,
          state: formData.state,
          pincode: formData.pincode,
          landmark: formData.landmark,
          detailsEdited,
          documentUrl,
          documentType,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'already_submitted') { router.replace('/confirmation'); return; }
        throw new Error(data.error);
      }
      router.replace('/confirmation');
    } catch {
      toast.error('Submission failed. Please try again.');
      setSubmitting(false);
    }
  };

  // ── Loading / empty ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#E3000F]" />
      </div>
    );
  }
  if (gifts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <div className="text-5xl mb-4">🎁</div>
        <h2 className="text-xl font-bold text-gray-700">No gifts available</h2>
        <p className="text-gray-500 mt-2">Please contact support.</p>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="pb-12">

        {/* Slab banner */}
        {slab && (
          <div className="mx-4 mt-4 rounded-2xl bg-gradient-to-r from-[#E3000F] to-[#c0000d] shadow-md flex items-center justify-between px-4 py-2.5">
            <p className="text-white/80 text-xs font-semibold uppercase tracking-widest">Your Reward Tier</p>
            <p className="text-[#FFD200] font-black text-2xl leading-none drop-shadow-sm">{slab.name}</p>
          </div>
        )}

        {/* Switch outlet link — only shown for multi-outlet owners */}
        {hasMultipleOutlets && (
          <button
            type="button"
            onClick={() => router.push('/select-outlet')}
            className="mx-4 mt-3 w-[calc(100%-2rem)] text-xs text-[#E3000F] font-medium bg-red-50 border border-red-100 rounded-xl px-3 py-2 text-left flex items-center justify-between"
          >
            <span>🏪 You have multiple outlets</span>
            <span className="underline">Switch outlet →</span>
          </button>
        )}

        {/* Section header */}
        <div className="pt-5 pb-3 px-4">
          <h2 className="text-xl font-bold text-gray-800">
            {isFullyLocked ? '🔒 Gift Selection Locked' : giftConfirmed ? '✅ Gift Confirmed' : 'Choose Your Gift'}
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            {isFullyLocked
              ? 'The 24-hour change window has closed.'
              : canChangeAfterConfirm
              ? 'You can still change your gift within the 24-hour window.'
              : 'Tap any gift to view details and select it.'}
          </p>
        </div>

        {/* 24h countdown — visible after confirming, until expired */}
        {countdown && giftConfirmed && (
          <div className={`mx-4 mb-3 rounded-xl px-3 py-2 text-xs font-medium flex items-center gap-2 ${
            countdown.expired
              ? 'bg-gray-100 text-gray-500'
              : countdown.urgent
              ? 'bg-red-50 text-red-600 border border-red-200'
              : 'bg-amber-50 text-amber-700 border border-amber-200'
          }`}>
            <span>{countdown.expired ? '🔒' : countdown.urgent ? '⚠️' : '⏱️'}</span>
            <span>{countdown.label}</span>
          </div>
        )}

        {/* Gift list */}
        <div className="px-4 space-y-3">
          {gifts.map((gift, i) => {
            const isSelected = selectedGift?.id === gift.id;
            const tappable = !giftConfirmed; // after confirm, use the Change Gift sheet
            return (
              <div
                key={gift.id}
                onClick={() => { if (tappable) setModalGift(gift); }}
                className={`flex gap-3 bg-white rounded-2xl shadow-sm overflow-hidden transition-all border ${
                  isSelected
                    ? 'border-green-400 ring-2 ring-green-400 shadow-md'
                    : 'border-transparent'
                } ${tappable ? 'cursor-pointer active:scale-[0.98] hover:shadow-md' : ''}`}
              >
                {/* Thumbnail */}
                <div className={`w-28 h-28 flex-none relative ${
                  gift.imageUrl ? 'bg-white' : `bg-gradient-to-br ${GRADIENT_COLORS[i % GRADIENT_COLORS.length]}`
                }`}>
                  {gift.imageUrl ? (
                    <Image src={gift.imageUrl} alt={gift.name} fill sizes="112px" className="object-contain p-1" />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <span className="text-4xl">🎁</span>
                    </div>
                  )}
                  {isSelected && (
                    <div className="absolute top-1.5 left-1.5 bg-green-500 rounded-full w-6 h-6 flex items-center justify-center shadow">
                      <span className="text-white text-xs font-bold">✓</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 py-3 pr-3 flex flex-col justify-center min-w-0">
                  <h3 className={`font-bold text-sm leading-tight ${isSelected ? 'text-green-700' : 'text-gray-800'}`}>
                    {gift.name}
                  </h3>
                  <p className="text-gray-500 text-xs mt-0.5 line-clamp-2 leading-relaxed">{gift.description}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    {gift.showMrp && gift.mrp && (
                      <span className="text-xs font-bold bg-[#FFD200] text-gray-900 px-2 py-0.5 rounded-full">
                        ₹{gift.mrp.toLocaleString('en-IN')}
                      </span>
                    )}
                    {tappable && (
                      <span className="text-xs text-[#E3000F] font-medium">
                        {isSelected ? 'Tap to view details' : 'Tap to view →'}
                      </span>
                    )}
                    {isSelected && giftConfirmed && (
                      <span className="text-xs text-green-600 font-medium">✓ Your gift</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Confirm / status section */}
        <div className="mt-5 px-4 space-y-3">
          {isFullyLocked && selectedGift ? (
            // Fully locked after 24h
            <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-2xl py-3.5 px-4">
              <span className="text-2xl">🔒</span>
              <div>
                <p className="text-gray-700 font-bold text-sm">{selectedGift.name}</p>
                <p className="text-gray-500 text-xs mt-0.5">Locked — 24-hour window has closed</p>
              </div>
            </div>
          ) : canChangeAfterConfirm && selectedGift ? (
            // Confirmed and within 24h — show confirmed badge + change button
            <>
              <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl py-3.5 px-4">
                <span className="text-2xl">✅</span>
                <div className="flex-1 min-w-0">
                  <p className="text-green-700 font-bold text-sm">{selectedGift.name}</p>
                  <p className="text-green-600 text-xs mt-0.5">Gift confirmed</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setChangeSheetOpen(true)}
                className="w-full border-2 border-[#E3000F] text-[#E3000F] font-bold py-3 rounded-2xl text-sm active:scale-95 transition-transform"
              >
                🔄 Change Gift Selection
              </button>
            </>
          ) : !giftConfirmed && selectedGift ? (
            // Not yet confirmed — show selected state + confirm button
            <>
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 flex items-center gap-2">
                <span className="text-base">🎁</span>
                <p className="text-sm text-blue-800 font-medium">{selectedGift.name} selected</p>
              </div>
              <button
                type="button"
                onClick={handleConfirmGift}
                disabled={confirmingGift}
                className="w-full bg-green-600 hover:bg-green-700 active:scale-95 text-white font-bold py-3.5 rounded-2xl text-base transition-all shadow-md disabled:opacity-60"
              >
                {confirmingGift ? 'Confirming…' : '✓ Confirm My Gift Selection'}
              </button>
            </>
          ) : !giftConfirmed ? (
            <p className="text-center text-gray-400 text-sm py-2">👆 Tap a gift above to get started</p>
          ) : null}
        </div>

        {/* Address form */}
        <div ref={formRef} className="mt-8 px-4">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-800">Verify Your Details</h2>
            <p className="text-gray-500 text-sm mt-1">Review and update your store information</p>
          </div>

          {detailsEdited && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 mb-4 text-sm text-amber-800">
              ✏️ You&apos;ve edited your address — a document upload will be required below.
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input value={retailerMobile} readOnly
                className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 bg-gray-50 text-gray-500 cursor-not-allowed" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Recipient&apos;s Name *</label>
              <input {...register('storeName', { required: "Recipient's name is required" })}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-[#E3000F] transition-colors"
                placeholder="Recipient's name" />
              {errors.storeName && <p className="text-red-500 text-xs mt-1">{errors.storeName.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1 *</label>
              <input {...register('addressLine1', { required: 'Address is required' })}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-[#E3000F] transition-colors"
                placeholder="Shop/Building number, Street" />
              {errors.addressLine1 && <p className="text-red-500 text-xs mt-1">{errors.addressLine1.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
              <input {...register('addressLine2')}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-[#E3000F] transition-colors"
                placeholder="Area, Colony (optional)" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Landmark</label>
              <input {...register('landmark')}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-[#E3000F] transition-colors"
                placeholder="Nearby landmark (optional)" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                <input {...register('city', { required: 'City is required' })}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-[#E3000F] transition-colors"
                  placeholder="City" />
                {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pincode *</label>
                <input {...register('pincode', { required: 'Required', pattern: { value: /^\d{6}$/, message: '6 digits' } })}
                  inputMode="numeric" maxLength={6}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-[#E3000F] transition-colors"
                  placeholder="Pincode" />
                {errors.pincode && <p className="text-red-500 text-xs mt-1">{errors.pincode.message}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
              <select {...register('state', { required: 'State is required' })}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-[#E3000F] bg-white transition-colors">
                <option value="">Select State</option>
                {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              {errors.state && <p className="text-red-500 text-xs mt-1">{errors.state.message}</p>}
            </div>
          </div>
        </div>

        {/* Document upload */}
        {detailsEdited && (
          <div className="mt-8 px-4">
            <div className="mb-3">
              <h2 className="text-xl font-bold text-gray-800">Upload Document</h2>
              <p className="text-gray-500 text-sm mt-1">Required since you edited your address</p>
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">Document Type</label>
              <div className="flex flex-wrap gap-2">
                {['GST Certificate', 'Trade License', 'Store Photo', 'Address Proof'].map((type) => (
                  <button key={type} type="button" onClick={() => setDocumentType(type)}
                    className={`px-3 py-2 rounded-xl text-sm font-medium border-2 transition-colors ${
                      documentType === type ? 'bg-[#E3000F] border-[#E3000F] text-white' : 'border-gray-200 text-gray-600 bg-white'}`}>
                    {type}
                  </button>
                ))}
              </div>
            </div>
            <label className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-6 cursor-pointer transition-colors ${
              documentUrl ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-gray-50 hover:border-[#E3000F]'}`}>
              <input type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden" onChange={handleFileUpload} disabled={uploading} />
              {uploading ? (
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E3000F]" />
              ) : documentUrl ? (
                <><span className="text-3xl mb-2">✅</span><p className="text-green-700 font-medium text-sm">Document uploaded</p><p className="text-gray-400 text-xs mt-1">Tap to replace</p></>
              ) : (
                <><span className="text-4xl mb-2">📄</span><p className="text-gray-600 font-medium">Tap to upload</p><p className="text-gray-400 text-xs mt-1">JPG, PNG or PDF · Max 5MB</p></>
              )}
            </label>
          </div>
        )}

        {/* Submit */}
        <div className="mt-8 px-4">
          <button type="submit" disabled={submitting || !giftConfirmed}
            className="w-full bg-[#E3000F] text-white font-bold py-4 rounded-2xl text-lg disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-transform shadow-lg">
            {submitting ? 'Submitting...' : 'Submit My Selection'}
          </button>
          {!selectedGift && (
            <p className="text-center text-gray-400 text-xs mt-2">Select a gift above to continue</p>
          )}
          {selectedGift && !giftConfirmed && (
            <p className="text-center text-gray-400 text-xs mt-2">Confirm your gift selection above to proceed</p>
          )}
        </div>
      </form>

      {/* ── Pre-confirm: Gift Detail Modal ── */}
      {modalGift && !giftConfirmed && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={() => setModalGift(null)}>
          <div className="bg-white rounded-t-3xl w-full max-w-lg max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className={`relative h-72 flex-none ${
              modalGift.imageUrl ? 'bg-white' : `bg-gradient-to-br ${GRADIENT_COLORS[gifts.findIndex((g) => g.id === modalGift.id) % GRADIENT_COLORS.length]}`}`}>
              {modalGift.imageUrl
                ? <Image src={modalGift.imageUrl} alt={modalGift.name} fill sizes="100vw" className="object-contain p-4 rounded-t-3xl" />
                : <div className="flex items-center justify-center h-full rounded-t-3xl"><span className="text-9xl">🎁</span></div>}
              <button onClick={() => setModalGift(null)}
                className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white rounded-full w-9 h-9 flex items-center justify-center text-lg font-bold">✕</button>
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-1 bg-white/50 rounded-full" />
            </div>
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
              <button onClick={() => handleSelectGift(modalGift)}
                className={`w-full mt-6 font-bold py-4 rounded-2xl text-base transition-all shadow-md active:scale-95 ${
                  selectedGift?.id === modalGift.id ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-[#E3000F] hover:bg-[#c0000d] text-white'}`}>
                {selectedGift?.id === modalGift.id ? '✓ Currently Selected' : 'Select This Gift'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Post-confirm: Change Gift Bottom Sheet ── */}
      {changeSheetOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60"
          onClick={() => { if (!changeModalGift) setChangeSheetOpen(false); }}>
          <div className="bg-white rounded-t-3xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Change Your Gift</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Currently: <span className="font-medium text-gray-700">{selectedGift?.name}</span>
                </p>
              </div>
              <button onClick={() => { setChangeSheetOpen(false); setChangeModalGift(null); }}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none">✕</button>
            </div>
            {/* Countdown */}
            {countdown && !countdown.expired && (
              <div className={`mx-5 mt-3 rounded-lg px-3 py-2 text-xs font-medium flex items-center gap-2 ${
                countdown.urgent ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}>
                <span>{countdown.urgent ? '⚠️' : '⏱️'}</span>
                <span>{countdown.label}</span>
              </div>
            )}
            {/* Gift list */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
              {gifts.map((gift, i) => {
                const isCurrent = selectedGift?.id === gift.id;
                return (
                  <div key={gift.id} onClick={() => !isCurrent && setChangeModalGift(gift)}
                    className={`flex gap-3 bg-white rounded-2xl shadow-sm overflow-hidden border transition-all ${
                      isCurrent ? 'border-green-400 bg-green-50 cursor-default' : 'border-gray-100 cursor-pointer active:scale-[0.98] hover:shadow-md'}`}>
                    <div className={`w-24 h-24 flex-none relative ${
                      gift.imageUrl ? 'bg-white' : `bg-gradient-to-br ${GRADIENT_COLORS[i % GRADIENT_COLORS.length]}`}`}>
                      {gift.imageUrl
                        ? <Image src={gift.imageUrl} alt={gift.name} fill sizes="96px" className="object-contain p-1" />
                        : <div className="flex items-center justify-center h-full"><span className="text-3xl">🎁</span></div>}
                      {isCurrent && (
                        <div className="absolute top-1 left-1 bg-green-500 rounded-full w-5 h-5 flex items-center justify-center">
                          <span className="text-white text-xs font-bold">✓</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 py-3 pr-3 flex flex-col justify-center min-w-0">
                      <h3 className={`font-bold text-sm leading-tight ${isCurrent ? 'text-green-700' : 'text-gray-800'}`}>{gift.name}</h3>
                      <p className="text-gray-500 text-xs mt-0.5 line-clamp-2">{gift.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {gift.showMrp && gift.mrp && (
                          <span className="text-xs font-bold bg-[#FFD200] text-gray-900 px-2 py-0.5 rounded-full">
                            ₹{gift.mrp.toLocaleString('en-IN')}
                          </span>
                        )}
                        <span className={`text-xs font-medium ${isCurrent ? 'text-green-600' : 'text-[#E3000F]'}`}>
                          {isCurrent ? 'Current selection' : 'Tap to select →'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Post-confirm: Change Gift Detail Modal (above the sheet) ── */}
      {changeModalGift && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70" onClick={() => setChangeModalGift(null)}>
          <div className="bg-white rounded-t-3xl w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className={`relative h-64 flex-none ${
              changeModalGift.imageUrl ? 'bg-white' : `bg-gradient-to-br ${GRADIENT_COLORS[gifts.findIndex((g) => g.id === changeModalGift.id) % GRADIENT_COLORS.length]}`}`}>
              {changeModalGift.imageUrl
                ? <Image src={changeModalGift.imageUrl} alt={changeModalGift.name} fill sizes="100vw" className="object-contain p-4 rounded-t-3xl" />
                : <div className="flex items-center justify-center h-full rounded-t-3xl"><span className="text-9xl">🎁</span></div>}
              <button onClick={() => setChangeModalGift(null)}
                className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white rounded-full w-9 h-9 flex items-center justify-center text-lg font-bold">✕</button>
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-1 bg-white/50 rounded-full" />
            </div>
            <div className="p-5 pb-8">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-xl font-bold text-gray-800">{changeModalGift.name}</h2>
                {changeModalGift.showMrp && changeModalGift.mrp && (
                  <span className="flex-none bg-[#FFD200] text-gray-900 text-sm font-bold px-3 py-1 rounded-full">
                    ₹{changeModalGift.mrp.toLocaleString('en-IN')}
                  </span>
                )}
              </div>
              <p className="text-gray-600 text-sm mt-3 leading-relaxed">{changeModalGift.description}</p>
              <button onClick={() => handleChangeGift(changeModalGift)} disabled={changingGift}
                className="w-full mt-6 bg-[#E3000F] hover:bg-[#c0000d] text-white font-bold py-4 rounded-2xl text-base transition-all shadow-md active:scale-95 disabled:opacity-60">
                {changingGift ? 'Changing…' : `Switch to ${changeModalGift.name}`}
              </button>
              <button onClick={() => setChangeModalGift(null)} className="w-full mt-3 text-gray-500 text-sm font-medium py-2">
                Cancel — go back
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
