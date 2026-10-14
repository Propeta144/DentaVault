import logoUrl from '../../assets/brand/teodosio-rufin-logo.png'
import { CLINIC_INFO } from '../../constants/clinic'

// Header ng lahat ng print page (Treatment Summary, Dental Chart 2D/3D,
// X-ray). Hiling ng clinic (client visit): kapareho ng header ng papel na
// form nila, kaya naka-gitna ang official logo, sinusundan ng address,
// mobile numbers (Smart/Globe), at email, tapos ang title ng page.
// Naka-alt pa rin ang pangalan para sa screen reader at kung hindi mag-load
// ang larawan.
export default function PrintHeader({ title }) {
  return (
    <header className="mb-6 border-b border-slate-200 pb-4 text-center">
      <img src={logoUrl} alt={CLINIC_INFO.name} className="mx-auto h-16 w-auto" />
      <p className="mt-2 text-sm text-slate-700">{CLINIC_INFO.address}</p>
      <p className="text-sm text-slate-700">
        Mobile: {CLINIC_INFO.phones.map((p) => `${p.number} (${p.network})`).join(' · ')}
      </p>
      <p className="text-sm text-slate-700">Email: {CLINIC_INFO.email}</p>
      <h1 className="mt-3 text-base font-bold uppercase tracking-wider text-slate-900">{title}</h1>
    </header>
  )
}
