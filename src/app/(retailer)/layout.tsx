export default function RetailerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="bg-[#E3000F] text-white shadow-md sticky top-0 z-50">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
              <span className="text-[#E3000F] font-black text-xs">KW</span>
            </div>
            <div>
              <p className="font-bold text-white text-lg leading-tight">Kwality Walls</p>
              <p className="text-white/80 text-xs">Gift Selection Program</p>
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
