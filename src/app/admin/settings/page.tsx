'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface Setting {
  id: string;
  campaignName: string;
  startDate: string | null;
  endDate: string | null;
  forceStatus: string | null;
  supportWhatsapp: string;
  otpExpiryMinutes: number;
  otpResendSeconds: number;
  maxDocSizeMb: number;
  whatsappEnabled: boolean;
}

export default function SettingsPage() {
  const router = useRouter();
  const [setting, setSetting] = useState<Setting | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/admin/settings', { credentials: 'include' })
      .then((r) => {
        if (r.status === 401) { router.replace('/admin/login'); return null; }
        return r.json();
      })
      .then((d) => { if (d) setSetting(d.setting); })
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false));
  }, [router]);

  const handleSave = async () => {
    if (!setting) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(setting),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Settings saved');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !setting) {
    return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#E3000F]" /></div>;
  }

  const formatDate = (d: string | null) => d ? new Date(d).toISOString().split('T')[0] : '';

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Settings</h1>
        <button onClick={handleSave} disabled={saving} className="px-5 py-2 bg-[#E3000F] text-white text-sm font-medium rounded-lg disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="space-y-4">
        {/* Campaign */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h2 className="font-bold text-gray-800 mb-4">Campaign Settings</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Campaign Name</label>
              <input value={setting.campaignName} onChange={(e) => setSetting({ ...setting, campaignName: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E3000F]" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Start Date</label>
                <input type="date" value={formatDate(setting.startDate)}
                  onChange={(e) => setSetting({ ...setting, startDate: e.target.value || null })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E3000F]" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">End Date</label>
                <input type="date" value={formatDate(setting.endDate)}
                  onChange={(e) => setSetting({ ...setting, endDate: e.target.value || null })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E3000F]" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Force Status Override</label>
              <select value={setting.forceStatus || ''} onChange={(e) => setSetting({ ...setting, forceStatus: e.target.value || null })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E3000F]">
                <option value="">Auto (based on dates)</option>
                <option value="active">Force Active</option>
                <option value="before">Force Before</option>
                <option value="closed">Force Closed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Support WhatsApp Number</label>
              <input value={setting.supportWhatsapp}
                onChange={(e) => setSetting({ ...setting, supportWhatsapp: e.target.value })}
                placeholder="91XXXXXXXXXX"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E3000F]" />
              <p className="text-xs text-gray-400 mt-1">Include country code without +, e.g. 919876543210</p>
            </div>
          </div>
        </div>

        {/* OTP Settings */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h2 className="font-bold text-gray-800 mb-4">OTP Settings</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">OTP Expiry (minutes)</label>
              <input type="number" value={setting.otpExpiryMinutes}
                onChange={(e) => setSetting({ ...setting, otpExpiryMinutes: parseInt(e.target.value) })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E3000F]" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Resend Cooldown (seconds)</label>
              <input type="number" value={setting.otpResendSeconds}
                onChange={(e) => setSetting({ ...setting, otpResendSeconds: parseInt(e.target.value) })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E3000F]" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Max Document Size (MB)</label>
              <input type="number" value={setting.maxDocSizeMb}
                onChange={(e) => setSetting({ ...setting, maxDocSizeMb: parseInt(e.target.value) })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E3000F]" />
            </div>
          </div>
        </div>

        {/* WhatsApp */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h2 className="font-bold text-gray-800 mb-4">WhatsApp Settings</h2>
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setSetting({ ...setting, whatsappEnabled: !setting.whatsappEnabled })}
              className={`w-12 h-6 rounded-full transition-colors ${setting.whatsappEnabled ? 'bg-green-500' : 'bg-gray-300'} relative`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-transform ${setting.whatsappEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-sm font-medium text-gray-700">
              {setting.whatsappEnabled ? 'WhatsApp confirmations enabled' : 'WhatsApp confirmations disabled'}
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
