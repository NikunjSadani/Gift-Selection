'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<'mobile' | 'otp'>('mobile');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [campaignStatus, setCampaignStatus] = useState<'active' | 'before' | 'closed' | null>(null);
  const [checking, setChecking] = useState(true);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Check if already logged in
    fetch('/api/retailer/me', { credentials: 'include' })
      .then((r) => {
        if (r.ok) return r.json();
        return null;
      })
      .then((data) => {
        if (data?.retailer?.submission) {
          router.replace('/confirmation');
        } else if (data?.retailer) {
          router.replace('/gift');
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false));

    // Check campaign
    fetch('/api/auth/request-otp', { method: 'POST', body: JSON.stringify({ mobile: '0000000000' }), headers: { 'Content-Type': 'application/json' } })
      .then((r) => r.json())
      .then((d) => {
        if (d.status === 'before' || d.status === 'closed') setCampaignStatus(d.status);
        else setCampaignStatus('active');
      })
      .catch(() => setCampaignStatus('active'));
  }, [router]);

  useEffect(() => {
    if (resendTimer > 0) {
      const t = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendTimer]);

  const handleSendOtp = async () => {
    if (!/^\d{10}$/.test(mobile)) {
      toast.error('Please enter a valid 10-digit mobile number');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'not_registered') toast.error('This number is not registered. Please contact support.');
        else if (data.error === 'inactive') toast.error('Your account is inactive. Please contact support.');
        else if (data.status === 'before') { setCampaignStatus('before'); }
        else if (data.status === 'closed') { setCampaignStatus('closed'); }
        else toast.error('Something went wrong. Try again.');
        return;
      }
      setStep('otp');
      setResendTimer(data.resendAfter || 45);
      if (data.devOtp) setDevOtp(data.devOtp);
      toast.success('OTP sent!');
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    const otpStr = otp.join('');
    if (otpStr.length !== 6) {
      toast.error('Please enter the complete 6-digit OTP');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, otp: otpStr }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error === 'invalid_otp' ? 'Invalid OTP. Please try again.' : 'Something went wrong.');
        return;
      }
      if (data.hasSubmission) {
        router.replace('/confirmation');
      } else {
        router.replace('/gift');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#E3000F]" />
      </div>
    );
  }

  if (campaignStatus === 'before') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-8 text-center">
        <div className="text-6xl mb-4">🗓️</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Coming Soon</h1>
        <p className="text-gray-600">The gift selection program has not started yet. Please check back later.</p>
      </div>
    );
  }

  if (campaignStatus === 'closed') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-8 text-center">
        <div className="text-6xl mb-4">🔒</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Program Closed</h1>
        <p className="text-gray-600">The gift selection program has ended. Thank you for your participation.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mt-8 mb-6 text-center">
        <h1 className="text-2xl font-bold text-gray-800">Welcome!</h1>
        <p className="text-gray-500 mt-1">Login to select your gift</p>
      </div>

      <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
        {step === 'mobile' ? (
          <>
            <label className="block text-sm font-medium text-gray-700 mb-2">Mobile Number</label>
            <input
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={10}
              value={mobile}
              onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="Enter 10-digit mobile number"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-lg focus:outline-none focus:border-[#E3000F] transition-colors"
              onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
            />
            <button
              onClick={handleSendOtp}
              disabled={loading || mobile.length !== 10}
              className="w-full mt-4 bg-[#E3000F] text-white font-bold py-4 rounded-xl text-lg disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-transform"
            >
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-4">
              Enter the OTP sent to <span className="font-semibold">+91 {mobile}</span>
              <button onClick={() => setStep('mobile')} className="ml-2 text-[#E3000F] text-sm underline">Change</button>
            </p>

            {devOtp && (
              <div className="bg-yellow-50 border border-yellow-300 rounded-xl px-4 py-3 mb-4 text-center">
                <p className="text-xs text-yellow-700 font-medium uppercase tracking-wide mb-1">Dev Mode — OTP</p>
                <p className="text-2xl font-mono font-bold text-yellow-800 tracking-widest">{devOtp}</p>
              </div>
            )}

            <div className="flex gap-2 justify-center mb-4">
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { otpRefs.current[i] = el; }}
                  type="tel"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  className="w-11 h-14 text-center text-xl font-bold border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#E3000F] transition-colors"
                />
              ))}
            </div>

            <button
              onClick={handleVerifyOtp}
              disabled={loading || otp.join('').length !== 6}
              className="w-full bg-[#E3000F] text-white font-bold py-4 rounded-xl text-lg disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-transform"
            >
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>

            <div className="text-center mt-3">
              {resendTimer > 0 ? (
                <p className="text-gray-500 text-sm">Resend OTP in {resendTimer}s</p>
              ) : (
                <button
                  onClick={handleSendOtp}
                  disabled={loading}
                  className="text-[#E3000F] text-sm font-medium underline"
                >
                  Resend OTP
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <p className="text-center text-xs text-gray-400 mt-6">
        Kwality Walls Gifting Program 2025
      </p>
    </div>
  );
}
