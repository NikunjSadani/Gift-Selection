import Image from 'next/image'

export default function RetailerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="bg-[#E3000F] shadow-md sticky top-0 z-50">
        <div className="max-w-md mx-auto px-4 py-2 flex items-center justify-between">
          <Image
            src="/kwality-walls-logo.png"
            alt="Kwality Wall's"
            width={130}
            height={52}
            priority
            style={{ filter: 'brightness(0) invert(1)' }}
          />
          <span className="text-white font-semibold text-sm text-right leading-tight">
            Kwality Klub
          </span>
        </div>
      </header>
      <main className="flex-1 max-w-md mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
