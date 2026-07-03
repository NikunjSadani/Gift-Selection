import Image from 'next/image'
import logo from '../../../public/kwality-walls-logo.png'

export default function RetailerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="bg-[#E3000F] shadow-lg sticky top-0 z-50">
        <div className="max-w-md mx-auto px-4 py-2 flex items-center justify-between gap-3">
          {/* Logo on white pill */}
          <div className="bg-white rounded-xl px-2 py-1 shadow-sm flex-shrink-0">
            <Image
              src={logo}
              alt="Kwality Wall's"
              width={56}
              height={56}
              priority
            />
          </div>

          {/* Right side branding */}
          <div className="text-right">
            <p className="text-white font-black text-base tracking-wide leading-tight">
              Kwality Klub
            </p>
            <div className="flex items-center justify-end gap-1 mt-0.5">
              <span className="w-4 h-px bg-[#FFD200]" />
              <p className="text-[#FFD200] text-[10px] font-semibold tracking-widest uppercase">
                Reward Program
              </p>
              <span className="w-4 h-px bg-[#FFD200]" />
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-md mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
