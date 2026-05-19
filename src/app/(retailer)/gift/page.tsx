'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import useEmblaCarousel from 'embla-carousel-react';
import { useForm } from 'react-hook-form';
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

interface FormData {
  storeName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  landmark: string;
  alternateMobile: string;
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

export default function GiftPage() {
  const router = useRouter();
  const formRef = useRef<HTMLDivElement>(null);

  const [gifts, setGifts] = useState<Gift[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedGift, setSelectedGift] = useState<Gift | null>(null);
  const [originalData, setOriginalData] = useState<Partial<FormData>>({});
  const [detailsEdited, setDetailsEdited] = useState(false);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [documentType, setDocumentType] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, align: 'center' });

  const { register, watch, setValue, handleSubmit, formState: { errors } } = useForm<FormData>();
  const watchedValues = watch();

  const onCarouselSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on('select', onCarouselSelect);
    onCarouselSelect();
  }, [emblaApi, onCarouselSelect]);

  // Detect edits vs original
  useEffect(() => {
    if (Object.keys(originalData).length === 0) return;
    const addressFields = ['storeName', 'addressLine1', 'addressLine2', 'city', 'state', 'pincode'] as const;
    const edited = addressFields.some((f) => (watchedValues[f] || '') !== (originalData[f] || ''));
    setDetailsEdited(edited);
  }, [watchedValues, originalData]);

  // Auto-save draft
  useEffect(() => {
    if (!selectedGift) return;
    const timer = setTimeout(async () => {
      try {
        await fetch('/api/draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ step: 'details', giftId: selectedGift.id, formData: JSON.stringify(watchedValues) }),
        });
      } catch {}
    }, 1000);
    return () => clearTimeout(timer);
  }, [watchedValues, selectedGift]);

  useEffect(() => {
    const load = async () => {
      try {
        const [giftsRes, meRes] = await Promise.all([
          fetch('/api/gifts', { credentials: 'include' }),
          fetch('/api/retailer/me', { credentials: 'include' }),
        ]);

        if (!giftsRes.ok) { router.replace('/'); return; }

        const giftsData = await giftsRes.json();
        const giftList: Gift[] = giftsData.gifts || [];
        setGifts(giftList);

        if (meRes.ok) {
          const { retailer } = await meRes.json();

          const prefill: Partial<FormData> = {
            storeName: retailer.name || '',
            addressLine1: retailer.addressLine1 || '',
            addressLine2: retailer.addressLine2 || '',
            city: retailer.city || '',
            state: retailer.state || '',
            pincode: retailer.pincode || '',
            landmark: '',
            alternateMobile: '',
          };

          const original = {
            storeName: retailer.name || '',
            addressLine1: retailer.addressLine1 || '',
            addressLine2: retailer.addressLine2 || '',
            city: retailer.city || '',
            state: retailer.state || '',
            pincode: retailer.pincode || '',
          };
          setOriginalData(original);

          if (retailer.draft?.formData) {
            try { Object.assign(prefill, JSON.parse(retailer.draft.formData)); } catch {}
          }
          Object.entries(prefill).forEach(([k, v]) => setValue(k as keyof FormData, v || ''));

          // Restore gift selection and carousel position from draft (no confetti on resume)
          if (retailer.draft?.giftId) {
            const idx = giftList.findIndex((g) => g.id === retailer.draft.giftId);
            if (idx >= 0) {
              setSelectedGift(giftList[idx]);
              setSelectedIndex(idx);
              setTimeout(() => emblaApi?.scrollTo(idx), 100);
            }
          }
        }
      } catch {
        toast.error('Failed to load. Please refresh.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [router, setValue, emblaApi]);

  const fireConfetti = () => {
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.4 },
      colors: ['#E3000F', '#FFD200', '#ffffff', '#ff6b6b', '#ffd93d'],
    });
    setTimeout(() => {
      confetti({
        particleCount: 60,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.5 },
        colors: ['#E3000F', '#FFD200', '#ffffff'],
      });
      confetti({
        particleCount: 60,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.5 },
        colors: ['#E3000F', '#FFD200', '#ffffff'],
      });
    }, 200);
  };

  const handleGiftTap = async (gift: Gift, index: number) => {
    const isNewSelection = selectedGift?.id !== gift.id;
    setSelectedGift(gift);
    emblaApi?.scrollTo(index);
    if (isNewSelection) fireConfetti();
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 600);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('File must be under 5MB'); return; }
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!allowed.includes(file.type)) { toast.error('Only JPG, PNG, or PDF allowed'); return; }

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

  const onSubmit = async (formData: FormData) => {
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
          alternateMobile: formData.alternateMobile,
          detailsEdited,
          documentUrl,
          documentType,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'already_submitted') {
          router.replace('/confirmation');
          return;
        }
        throw new Error(data.error);
      }
      router.replace('/confirmation');
    } catch {
      toast.error('Submission failed. Please try again.');
      setSubmitting(false);
    }
  };

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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="pb-12">

      {/* ── Gift Carousel ── */}
      <div className="pt-4 pb-2 text-center px-4">
        <h2 className="text-xl font-bold text-gray-800">Select Your Gift</h2>
        <p className="text-gray-500 text-sm mt-1">Tap a gift to select it</p>
      </div>

      <div ref={emblaRef} className="overflow-hidden px-4">
        <div className="flex gap-4">
          {gifts.map((gift, i) => {
            const isSelected = selectedGift?.id === gift.id;
            return (
              <div key={gift.id} className="flex-none w-[85vw] max-w-sm">
                <div
                  onClick={() => handleGiftTap(gift, i)}
                  className={`rounded-3xl overflow-hidden shadow-xl h-[55vh] flex flex-col bg-gradient-to-br ${GRADIENT_COLORS[i % GRADIENT_COLORS.length]} cursor-pointer transition-all duration-300 ${
                    i === selectedIndex ? 'scale-100' : 'scale-95 opacity-75'
                  } ${isSelected ? 'ring-4 ring-white ring-offset-2 ring-offset-transparent' : ''}`}
                >
                  <div className="flex-1 flex items-center justify-center p-8 relative">
                    {isSelected && (
                      <div className="absolute top-3 right-3 bg-white rounded-full w-8 h-8 flex items-center justify-center shadow-md">
                        <span className="text-green-500 text-lg font-bold">✓</span>
                      </div>
                    )}
                    <div className="w-44 h-44 bg-white/20 rounded-2xl flex items-center justify-center">
                      <span className="text-7xl">🎁</span>
                    </div>
                  </div>
                  <div className="bg-white/95 p-5 rounded-b-3xl">
                    <h3 className="font-bold text-gray-800 text-xl">{gift.name}</h3>
                    <p className="text-gray-600 text-sm mt-1 line-clamp-2">{gift.description}</p>
                    {gift.showMrp && gift.mrp && (
                      <span className="inline-block mt-2 bg-[#FFD200] text-gray-900 text-xs font-bold px-3 py-1 rounded-full">
                        ₹{gift.mrp.toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dot indicators */}
      <div className="flex justify-center gap-2 mt-4">
        {gifts.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => emblaApi?.scrollTo(i)}
            className={`h-2 rounded-full transition-all ${i === selectedIndex ? 'bg-[#E3000F] w-6' : 'bg-gray-300 w-2'}`}
          />
        ))}
      </div>

      {selectedGift && (
        <p className="text-center text-sm font-medium text-green-600 mt-3">
          🎉 {selectedGift.name} selected!
        </p>
      )}

      {/* ── Address Form ── */}
      <div ref={formRef} className="mt-8 px-4">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-800">Verify Your Details</h2>
          <p className="text-gray-500 text-sm mt-1">Review and update your store information</p>
        </div>

        {detailsEdited && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 mb-4 text-sm text-amber-800">
            ✏️ You've edited your address — a document upload will be required below.
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Store Name *</label>
            <input
              {...register('storeName', { required: 'Store name is required' })}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#E3000F] transition-colors"
              placeholder="Your store name"
            />
            {errors.storeName && <p className="text-red-500 text-xs mt-1">{errors.storeName.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1 *</label>
            <input
              {...register('addressLine1', { required: 'Address is required' })}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#E3000F] transition-colors"
              placeholder="Shop/Building number, Street"
            />
            {errors.addressLine1 && <p className="text-red-500 text-xs mt-1">{errors.addressLine1.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
            <input
              {...register('addressLine2')}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#E3000F] transition-colors"
              placeholder="Area, Colony (optional)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Landmark</label>
            <input
              {...register('landmark')}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#E3000F] transition-colors"
              placeholder="Nearby landmark (optional)"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
              <input
                {...register('city', { required: 'City is required' })}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#E3000F] transition-colors"
                placeholder="City"
              />
              {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pincode *</label>
              <input
                {...register('pincode', { required: 'Required', pattern: { value: /^\d{6}$/, message: '6 digits' } })}
                inputMode="numeric"
                maxLength={6}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#E3000F] transition-colors"
                placeholder="Pincode"
              />
              {errors.pincode && <p className="text-red-500 text-xs mt-1">{errors.pincode.message}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
            <select
              {...register('state', { required: 'State is required' })}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#E3000F] bg-white transition-colors"
            >
              <option value="">Select State</option>
              {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {errors.state && <p className="text-red-500 text-xs mt-1">{errors.state.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Alternate Mobile</label>
            <input
              {...register('alternateMobile')}
              inputMode="numeric"
              maxLength={10}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#E3000F] transition-colors"
              placeholder="Alternate mobile (optional)"
            />
          </div>
        </div>
      </div>

      {/* ── Document Upload (conditional) ── */}
      {detailsEdited && (
        <div className="mt-8 px-4">
          <div className="mb-3">
            <h2 className="text-xl font-bold text-gray-800">Upload Document</h2>
            <p className="text-gray-500 text-sm mt-1">Required since you edited your address</p>
          </div>

          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">Document Type</label>
            <div className="flex flex-wrap gap-2">
              {['GST Certificate', 'Trade License', 'Visiting Card', 'Store Photo', 'Address Proof'].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setDocumentType(type)}
                  className={`px-3 py-2 rounded-xl text-sm font-medium border-2 transition-colors ${
                    documentType === type
                      ? 'bg-[#E3000F] border-[#E3000F] text-white'
                      : 'border-gray-200 text-gray-600 bg-white'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <label className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-6 cursor-pointer transition-colors ${
            documentUrl ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-gray-50 hover:border-[#E3000F]'
          }`}>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
            />
            {uploading ? (
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E3000F]" />
            ) : documentUrl ? (
              <>
                <span className="text-3xl mb-2">✅</span>
                <p className="text-green-700 font-medium text-sm">Document uploaded</p>
                <p className="text-gray-400 text-xs mt-1">Tap to replace</p>
              </>
            ) : (
              <>
                <span className="text-4xl mb-2">📄</span>
                <p className="text-gray-600 font-medium">Tap to upload</p>
                <p className="text-gray-400 text-xs mt-1">JPG, PNG or PDF · Max 5MB</p>
              </>
            )}
          </label>
        </div>
      )}

      {/* ── Submit ── */}
      <div className="mt-8 px-4">
        <button
          type="submit"
          disabled={submitting || !selectedGift}
          className="w-full bg-[#E3000F] text-white font-bold py-4 rounded-2xl text-lg disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-transform shadow-lg"
        >
          {submitting ? 'Submitting...' : 'Submit My Selection'}
        </button>
        {!selectedGift && (
          <p className="text-center text-gray-400 text-xs mt-2">Select a gift above to continue</p>
        )}
      </div>
    </form>
  );
}
