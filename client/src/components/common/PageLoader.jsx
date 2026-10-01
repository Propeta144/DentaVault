import { Loader2 } from 'lucide-react'

// Iisang loading indicator para sa buong app — ginagamit habang dina-download
// ang isang lazy-loaded na page (Suspense fallback sa App.jsx/AppLayout.jsx)
// at habang kinukuha ng page ang data niya galing sa API. Dati iba-iba ang
// itsura ng "Loading..." bawat page; ngayon pare-pareho na.
// `fullScreen`: para sa mga page na walang sidebar (login, print pages).
export default function PageLoader({ label = 'Loading...', fullScreen = false }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-3 text-slate-500 ${
        fullScreen ? 'min-h-screen' : 'py-16'
      }`}
    >
      <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
      <p className="text-sm font-medium">{label}</p>
    </div>
  )
}
