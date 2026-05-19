'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

const DOC_TYPES = [
  'GST Certificate',
  'Trade License',
  'Visiting Card',
  'Store Photo',
  'Address Proof',
];

export default function UploadPage() {
  const router = useRouter();
  const [docType, setDocType] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(f.type)) {
      toast.error('Only JPG, PNG, and PDF files are allowed');
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.error('File size must be under 5MB');
      return;
    }

    setFile(f);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', f);

      const res = await fetch('/api/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      setUploadedUrl(data.url);
      toast.success('File uploaded successfully');
    } catch {
      toast.error('Upload failed. Please try again.');
      setFile(null);
    } finally {
      setUploading(false);
    }
  };

  const handleContinue = async () => {
    if (!uploadedUrl) {
      toast.error('Please upload a document first');
      return;
    }
    if (!docType) {
      toast.error('Please select document type');
      return;
    }
    setSaving(true);
    try {
      const meRes = await fetch('/api/retailer/me', { credentials: 'include' });
      const meData = await meRes.json();
      const draftFormData = meData.retailer?.draft?.formData
        ? JSON.parse(meData.retailer.draft.formData)
        : {};

      await fetch('/api/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          step: 'review',
          formData: { ...draftFormData, documentUrl: uploadedUrl, documentType: docType },
        }),
      });
      router.push('/review');
    } catch {
      toast.error('Failed to save. Please try again.');
      setSaving(false);
    }
  };

  const handleRemove = () => {
    setFile(null);
    setUploadedUrl('');
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="p-4 pb-8">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800">Upload Document</h2>
        <p className="text-gray-500 text-sm mt-1">
          Since you updated your store details, please upload a supporting document for verification.
        </p>
      </div>

      <div className="bg-[#FFD200]/20 border border-[#FFD200] rounded-xl p-4 mb-6">
        <p className="text-amber-800 text-sm font-medium">Accepted formats: JPG, PNG, PDF (max 5MB)</p>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Document Type *</label>
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#E3000F] bg-white"
        >
          <option value="">Select document type</option>
          {DOC_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".jpg,.jpeg,.png,.pdf"
        onChange={handleFileChange}
        className="hidden"
        capture="environment"
      />

      {!file ? (
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full border-2 border-dashed border-gray-300 rounded-2xl p-10 flex flex-col items-center justify-center gap-3 text-gray-500 hover:border-[#E3000F] hover:text-[#E3000F] transition-colors active:scale-95"
        >
          <div className="text-5xl">📄</div>
          <p className="font-semibold text-lg">Tap to upload</p>
          <p className="text-sm">Camera or Gallery</p>
        </button>
      ) : (
        <div className="border-2 border-green-300 bg-green-50 rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="text-3xl">
              {file.type === 'application/pdf' ? '📄' : '🖼️'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800 truncate">{file.name}</p>
              <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
              {uploading && <p className="text-sm text-blue-500">Uploading...</p>}
              {uploadedUrl && <p className="text-sm text-green-600">Uploaded successfully</p>}
            </div>
            <button onClick={handleRemove} className="text-red-500 text-sm font-medium">Remove</button>
          </div>
        </div>
      )}

      {uploading && (
        <div className="mt-4 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E3000F]" />
        </div>
      )}

      <button
        onClick={handleContinue}
        disabled={!uploadedUrl || !docType || saving || uploading}
        className="w-full mt-6 bg-[#E3000F] text-white font-bold py-4 rounded-2xl text-lg disabled:opacity-50 active:scale-95 transition-transform"
      >
        {saving ? 'Saving...' : 'Continue to Review'}
      </button>

      <button
        onClick={() => router.push('/review')}
        className="w-full mt-2 text-gray-500 py-2 text-sm underline"
      >
        Skip for now
      </button>
    </div>
  );
}
