'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import useEmblaCarousel from 'embla-carousel-react';
import toast from 'react-hot-toast';

interface Gift {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  mrp: number | null;
  showMrp: boolean;
}

const GRADIENT_COLORS = [
  'from-red-400 to-orange-500',
  'from-blue-400 to-purple-500',
  'from-green-400 to-teal-500',
  'from-yellow-400 to-orange-400',
  'from-pink-400 to-rose-500',
  'from-indigo-400 to-blue-500',
];

export default function GiftPage() {
  const router = useRouter();
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedGift, setSelectedGift] = useState<Gift | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, align: 'center' });

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on('select', onSelect);
    onSelect();
  }, [emblaApi, onSelect]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [giftsRes, meRes] = await Promise.all([
          fetch('/api/gifts', { credentials: 'include' }),
          fetch('/api/retailer/me', { credentials: 'include' }),
        ]);

        if (!giftsRes.ok) {
          router.replace('/');
          return;
        }

        const giftsData = await giftsRes.json();
        setGifts(giftsData.gifts || []);

        if (meRes.ok) {
          const meData = await meRes.json();
          if (meData.retailer?.draft?.giftId) {
            const draftGiftIndex = (giftsData.gifts || []).findIndex(
              (g: Gift) => g.id === meData.retailer.draft.giftId
            );
            if (draftGiftIndex >= 0) {
              setSelectedIndex(draftGiftIndex);
              setTimeout(() => emblaApi?.scrollTo(draftGiftIndex), 100);
            }
          }
        }
      } catch {
        toast.error('Failed to load gifts');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [router, emblaApi]);

  const handleSelectGift = () => {
    setSelectedGift(gifts[selectedIndex]);
    setShowModal(true);
  };

  const handleConfirm = async () => {
    if (!selectedGift) return;
    setSaving(true);
    try {
      await fetch('/api/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ step: 'details', giftId: selectedGift.id }),
      });
      router.push('/details');
    } catch {
      toast.error('Failed to save selection');
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
    <div className="flex flex-col min-h-[calc(100vh-64px)]">
      <div className="p-4 text-center">
        <h2 className="text-xl font-bold text-gray-800">Select Your Gift</h2>
        <p className="text-gray-500 text-sm mt-1">Swipe to explore all options</p>
      </div>

      <div className="flex-1 flex flex-col">
        <div ref={emblaRef} className="overflow-hidden px-4">
          <div className="flex gap-4">
            {gifts.map((gift, i) => (
              <div key={gift.id} className="flex-none w-[85vw] max-w-sm">
                <div
                  className={`rounded-3xl overflow-hidden shadow-xl h-[55vh] flex flex-col bg-gradient-to-br ${GRADIENT_COLORS[i % GRADIENT_COLORS.length]} transition-transform duration-300 ${i === selectedIndex ? 'scale-100' : 'scale-95 opacity-80'}`}
                >
                  <div className="flex-1 flex items-center justify-center p-8">
                    <div className="w-48 h-48 bg-white/20 rounded-2xl flex items-center justify-center">
                      <span className="text-7xl">🎁</span>
                    </div>
                  </div>
                  <div className="bg-white/95 p-5 rounded-b-3xl">
                    <h3 className="font-bold text-gray-800 text-xl">{gift.name}</h3>
                    <p className="text-gray-600 text-sm mt-1 line-clamp-2">{gift.description}</p>
                    {gift.showMrp && gift.mrp && (
                      <p className="text-[#E3000F] font-bold mt-2">MRP: ₹{gift.mrp.toLocaleString('en-IN')}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-2 mt-4">
          {gifts.map((_, i) => (
            <button
              key={i}
              onClick={() => emblaApi?.scrollTo(i)}
              className={`w-2 h-2 rounded-full transition-all ${i === selectedIndex ? 'bg-[#E3000F] w-6' : 'bg-gray-300'}`}
            />
          ))}
        </div>

        <div className="p-4 mt-auto">
          <button
            onClick={handleSelectGift}
            className="w-full bg-[#E3000F] text-white font-bold py-4 rounded-2xl text-lg active:scale-95 transition-transform shadow-lg"
          >
            Select This Gift
          </button>
          <p className="text-center text-gray-400 text-xs mt-2">{selectedIndex + 1} of {gifts.length}</p>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showModal && selectedGift && (
        <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm">
            <h3 className="text-xl font-bold text-gray-800 text-center mb-4">Confirm Your Gift</h3>
            <div className="bg-gray-50 rounded-2xl p-4 mb-4 text-center">
              <div className="text-5xl mb-2">🎁</div>
              <p className="font-bold text-gray-800 text-lg">{selectedGift.name}</p>
              <p className="text-gray-500 text-sm mt-1">{selectedGift.description}</p>
              {selectedGift.showMrp && selectedGift.mrp && (
                <p className="text-[#E3000F] font-bold mt-1">MRP: ₹{selectedGift.mrp.toLocaleString('en-IN')}</p>
              )}
            </div>
            <p className="text-gray-500 text-sm text-center mb-4">Are you sure you want to select this gift? You can change it on the review screen.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 border-2 border-gray-200 text-gray-700 font-semibold py-3 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={saving}
                className="flex-1 bg-[#E3000F] text-white font-bold py-3 rounded-xl disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
