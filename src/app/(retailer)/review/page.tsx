'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface DraftFormData {
  storeName?: string;
  ownerName?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstNumber?: string;
  landmark?: string;
  alternateMobile?: string;
  detailsEdited?: boolean;
  documentUrl?: string;
  documentType?: string;
}

interface Gift {
  id: string;
  name: string;
  description: string;
}

function Field({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-gray-800 font-medium">{value}</p>
    </div>
  );
}

export default function ReviewPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [gift, setGift] = useState<Gift | null>(null);
  const [formData, setFormData] = useState<DraftFormData>({});
  const [giftId, setGiftId] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [meRes, giftsRes] = await Promise.all([
          fetch('/api/retailer/me', { credentials: 'include' }),
          fetch('/api/gifts', { credentials: 'include' }),
        ]);

        if (!meRes.ok) { router.replace('/'); return; }

        const meData = await meRes.json();
        const retailer = meData.retailer;

        if (!retailer.draft?.giftId) {
          router.replace('/gift');
          return;
        }

        setGiftId(retailer.draft.giftId);

        if (retailer.draft.formData) {
          try {
            setFormData(JSON.parse(retailer.draft.formData));
          } catch {}
        }

        if (giftsRes.ok) {
          const giftsData = await giftsRes.json();
          const selectedGift = giftsData.gifts?.find((g: Gift) => g.id === retailer.draft.giftId);
          setGift(selectedGift || null);
        }
      } catch {
        toast.error('Failed to load review data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [router]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          giftId,
          storeName: formData.storeName,
          ownerName: formData.ownerName,
          addressLine1: formData.addressLine1,
          addressLine2: formData.addressLine2,
          city: formData.city,
          state: formData.state,
          pincode: formData.pincode,
          gstNumber: formData.gstNumber,
          landmark: formData.landmark,
          alternateMobile: formData.alternateMobile,
          detailsEdited: formData.detailsEdited,
          documentUrl: formData.documentUrl,
          documentType: formData.documentType,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'already_submitted') {
          router.replace('/confirmation');
          return;
        }
        toast.error('Submission failed. Please try again.');
        return;
      }

      router.replace('/confirmation');
    } catch {
      toast.error('Network error. Please try again.');
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

  return (
    <div className="p-4 pb-8">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-800">Review & Submit</h2>
        <p className="text-gray-500 text-sm mt-1">Please verify your details before submitting</p>
      </div>

      {/* Gift */}
      <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-2xl p-4 mb-4 border border-red-100">
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Selected Gift</p>
        <div className="flex items-center gap-3">
          <span className="text-4xl">🎁</span>
          <div>
            <p className="font-bold text-gray-800 text-lg">{gift?.name || 'Loading...'}</p>
            <p className="text-gray-500 text-sm">{gift?.description}</p>
          </div>
        </div>
        <button
          onClick={() => router.push('/gift')}
          className="mt-2 text-[#E3000F] text-sm underline"
        >
          Change gift
        </button>
      </div>

      {/* Details */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4 space-y-3">
        <div className="flex justify-between items-center">
          <p className="font-semibold text-gray-800">Store Details</p>
          <button onClick={() => router.push('/details')} className="text-[#E3000F] text-sm underline">Edit</button>
        </div>
        <Field label="Store Name" value={formData.storeName} />
        <Field label="Owner Name" value={formData.ownerName} />
        <Field label="Address" value={[formData.addressLine1, formData.addressLine2].filter(Boolean).join(', ')} />
        <Field label="Landmark" value={formData.landmark} />
        <Field label="City" value={formData.city} />
        <Field label="State" value={formData.state} />
        <Field label="Pincode" value={formData.pincode} />
        <Field label="GST Number" value={formData.gstNumber} />
        <Field label="Alternate Mobile" value={formData.alternateMobile} />
      </div>

      {/* Document */}
      {formData.documentUrl && (
        <div className="bg-green-50 rounded-2xl border border-green-200 p-4 mb-4">
          <p className="font-semibold text-gray-800 mb-1">Document Uploaded</p>
          <p className="text-sm text-gray-600">{formData.documentType}</p>
          <p className="text-xs text-green-600 mt-1">File uploaded successfully</p>
        </div>
      )}

      {formData.detailsEdited && !formData.documentUrl && (
        <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4 mb-4">
          <p className="text-amber-700 text-sm">You edited your details but no document was uploaded.</p>
          <button onClick={() => router.push('/upload')} className="text-[#E3000F] text-sm underline mt-1">Upload document</button>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full bg-[#E3000F] text-white font-bold py-4 rounded-2xl text-lg disabled:opacity-50 active:scale-95 transition-transform shadow-lg"
      >
        {submitting ? 'Submitting...' : 'Submit Gift Selection'}
      </button>

      <p className="text-center text-xs text-gray-400 mt-3">
        Once submitted, your selection cannot be changed.
      </p>
    </div>
  );
}
