import logoUrl from '../../assets/brand/teodosio-rufin-logo.png'

// Header ng tatlong print page (Treatment Summary, Dental Chart, X-ray):
// ang official logo ng clinic na ngayon, kapalit ng plain na text na
// "Teodosio-Rufin Dental Clinic". Naka-alt pa rin ang pangalan para sa
// screen reader at kung sakaling hindi mag-load ang larawan.
export default function PrintHeader({ title }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4 border-b border-slate-200 pb-4">
      <h1>
        <img src={logoUrl} alt="Teodosio-Rufin Dental Clinic" className="h-14 w-auto" />
      </h1>
      <p className="text-right text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</p>
    </div>
  )
}
