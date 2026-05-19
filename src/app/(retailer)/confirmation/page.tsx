'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Submission {
  referenceId: string;
  storeName: string;
  submittedAt: string;
  gift: { name: string };
}

export default function ConfirmationPage() {
  const router = useRouter();
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [supportNumber, setSupportNumber] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/retailer/me', { credentials: 'include' });
        if (!res.ok) { router.replace('/'); return; }
        const { retailer } = await res.json();

        if (!retailer.submission) {
          router.replace('/gift');
          return;
        }

        setSubmission(retailer.submission);

        // Get support number
        fetch('/api/auth/request-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mobile: '0000000000' }),
        })
          .then((r) => r.json())
          .catch(() => ({}));
      } catch {
        router.replace('/');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#E3000F]" />
      </div>
    );
  }

  if (!submission) return null;

  const submittedDate = new Date(submission.submittedAt);

  return (
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

      <div className="bg-gradient-to-br from-[#E3000F] to-red-700 rounded-2xl p-6 w-full mb-6 text-white shadow-xl">
        <p className="text-white/80 text-sm mb-1">Reference ID</p>
        <p className="text-3xl font-black tracking-wider">{submission.referenceId}</p>
        <div className="mt-4 pt-4 border-t border-white/20">
          <p className="text-white/80 text-xs">Selected Gift</p>
          <p className="font-bold text-lg">{submission.gift.name}</p>
        </div>
      </div>

      <div className="bg-gray-50 rounded-xl p-4 w-full mb-6">
        <p className="text-xs text-gray-400 uppercase tracking-wide">Submitted on</p>
        <p className="font-semibold text-gray-700">
          {submittedDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
          {' '}at{' '}
          {submittedDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      {supportNumber && (
        <a
          href={`https://wa.me/${supportNumber}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 bg-green-500 text-white font-bold py-4 px-8 rounded-2xl text-lg active:scale-95 transition-transform shadow-lg"
        >
          <span className="text-2xl">💬</span>
          WhatsApp Support
        </a>
      )}

      <p className="text-xs text-gray-400 mt-6">
        Keep your Reference ID safe. You may need it for any queries.
      </p>
    </div>
  );
}
