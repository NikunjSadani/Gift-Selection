import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white text-center p-8">
      <div className="text-8xl font-black text-[#E3000F] mb-4">404</div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Page Not Found</h1>
      <p className="text-gray-500 mb-6">The page you are looking for does not exist.</p>
      <Link
        href="/"
        className="bg-[#E3000F] text-white font-bold px-6 py-3 rounded-xl hover:bg-red-700 transition-colors"
      >
        Go Home
      </Link>
    </div>
  )
}
