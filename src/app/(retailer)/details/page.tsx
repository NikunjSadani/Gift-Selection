'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Puducherry', 'Chandigarh',
];

interface FormData {
  storeName: string;
  ownerName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  gstNumber: string;
  landmark: string;
  alternateMobile: string;
}

export default function DetailsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [originalData, setOriginalData] = useState<Partial<FormData>>({});
  const [detailsEdited, setDetailsEdited] = useState(false);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>();

  const watchedValues = watch();

  const checkEdited = useCallback((values: Partial<FormData>) => {
    if (Object.keys(originalData).length === 0) return false;
    const fields = ['storeName', 'ownerName', 'addressLine1', 'addressLine2', 'city', 'state', 'pincode', 'gstNumber'] as const;
    return fields.some((f) => (values[f] || '') !== (originalData[f] || ''));
  }, [originalData]);

  useEffect(() => {
    setDetailsEdited(checkEdited(watchedValues));
  }, [watchedValues, checkEdited]);

  // Debounced auto-save
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (Object.keys(watchedValues).length === 0) return;
      try {
        await fetch('/api/draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ step: 'details', formData: watchedValues }),
        });
      } catch {}
    }, 1000);
    return () => clearTimeout(timer);
  }, [watchedValues]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/retailer/me', { credentials: 'include' });
        if (!res.ok) { router.replace('/'); return; }
        const { retailer } = await res.json();

        if (!retailer.draft?.giftId) {
          router.replace('/gift');
          return;
        }

        const prefill: Partial<FormData> = {
          storeName: retailer.name || '',
          ownerName: retailer.ownerName || '',
          addressLine1: retailer.addressLine1 || '',
          addressLine2: retailer.addressLine2 || '',
          city: retailer.city || '',
          state: retailer.state || '',
          pincode: retailer.pincode || '',
          gstNumber: retailer.gstNumber || '',
          landmark: '',
          alternateMobile: '',
        };

        // Override with draft form data if present
        if (retailer.draft?.formData) {
          try {
            const draftForm = JSON.parse(retailer.draft.formData);
            Object.assign(prefill, draftForm);
          } catch {}
        }

        setOriginalData({
          storeName: retailer.name || '',
          ownerName: retailer.ownerName || '',
          addressLine1: retailer.addressLine1 || '',
          addressLine2: retailer.addressLine2 || '',
          city: retailer.city || '',
          state: retailer.state || '',
          pincode: retailer.pincode || '',
          gstNumber: retailer.gstNumber || '',
        });

        Object.entries(prefill).forEach(([k, v]) => setValue(k as keyof FormData, v || ''));
      } catch {
        toast.error('Failed to load your details');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [router, setValue]);

  const onSubmit = async (data: FormData) => {
    setSaving(true);
    try {
      await fetch('/api/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ step: detailsEdited ? 'upload' : 'review', formData: { ...data, detailsEdited } }),
      });

      if (detailsEdited) {
        router.push('/upload');
      } else {
        router.push('/review');
      }
    } catch {
      toast.error('Failed to save details');
      setSaving(false);
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
        <h2 className="text-xl font-bold text-gray-800">Verify Your Details</h2>
        <p className="text-gray-500 text-sm mt-1">Please review and update your store information</p>
      </div>

      {detailsEdited && (
        <div className="bg-[#FFD200]/20 border border-[#FFD200] rounded-xl p-3 mb-4 text-sm text-amber-800">
          You have edited details. A document upload will be required.
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Store Name *</label>
          <input
            {...register('storeName', { required: 'Store name is required' })}
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#E3000F]"
            placeholder="Your store name"
          />
          {errors.storeName && <p className="text-red-500 text-xs mt-1">{errors.storeName.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Owner Name *</label>
          <input
            {...register('ownerName', { required: 'Owner name is required' })}
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#E3000F]"
            placeholder="Owner's full name"
          />
          {errors.ownerName && <p className="text-red-500 text-xs mt-1">{errors.ownerName.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1 *</label>
          <input
            {...register('addressLine1', { required: 'Address is required' })}
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#E3000F]"
            placeholder="Shop/Building number, Street"
          />
          {errors.addressLine1 && <p className="text-red-500 text-xs mt-1">{errors.addressLine1.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
          <input
            {...register('addressLine2')}
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#E3000F]"
            placeholder="Area, Colony (optional)"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Landmark</label>
          <input
            {...register('landmark')}
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#E3000F]"
            placeholder="Nearby landmark (optional)"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
            <input
              {...register('city', { required: 'City is required' })}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#E3000F]"
              placeholder="City"
            />
            {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pincode *</label>
            <input
              {...register('pincode', { required: 'Pincode is required', pattern: { value: /^\d{6}$/, message: '6-digit pincode' } })}
              inputMode="numeric"
              maxLength={6}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#E3000F]"
              placeholder="Pincode"
            />
            {errors.pincode && <p className="text-red-500 text-xs mt-1">{errors.pincode.message}</p>}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
          <select
            {...register('state', { required: 'State is required' })}
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#E3000F] bg-white"
          >
            <option value="">Select State</option>
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {errors.state && <p className="text-red-500 text-xs mt-1">{errors.state.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">GST Number</label>
          <input
            {...register('gstNumber')}
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#E3000F]"
            placeholder="GST Number (optional)"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Alternate Mobile</label>
          <input
            {...register('alternateMobile')}
            inputMode="numeric"
            maxLength={10}
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#E3000F]"
            placeholder="Alternate mobile number (optional)"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-[#E3000F] text-white font-bold py-4 rounded-2xl text-lg mt-4 disabled:opacity-50 active:scale-95 transition-transform"
        >
          {saving ? 'Saving...' : detailsEdited ? 'Save & Continue to Upload' : 'Save & Continue'}
        </button>
      </form>
    </div>
  );
}
