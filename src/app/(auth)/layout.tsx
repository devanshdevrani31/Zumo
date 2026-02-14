export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-4">
      {/* Zumo Branding */}
      <div className="mb-8 flex items-center gap-1">
        <span className="text-3xl font-bold tracking-tight text-white">ZUMO</span>
        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 mt-1" />
      </div>

      {/* Auth Card */}
      <div className="w-full max-w-md bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-8">
        {children}
      </div>

      {/* Footer */}
      <p className="mt-6 text-xs text-slate-500">
        AI Employee Platform &mdash; Secure by default
      </p>
    </div>
  )
}
