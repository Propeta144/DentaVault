import { ClipboardList, ScanLine, ShieldCheck } from 'lucide-react'
import BrandMark from './BrandMark'

export const HIGHLIGHTS = [
  { icon: ClipboardList, text: 'Treatment history and dental charting in one record' },
  { icon: ScanLine, text: 'X-rays stored, annotated, and compared side by side' },
  { icon: ShieldCheck, text: 'Every access logged, as required by the Data Privacy Act' },
]

// Madilim na brand panel sa kaliwa ng Welcome at Login page (lg pataas lang).
// Madilim na panel: slate-400 ang secondary text dito (6.8:1 sa slate-950).
// Ang slate-500 ay 3.85:1 lang sa madilim (audit 2026-10-26).
export default function AuthBrandPanel() {
  return (
    <aside className="relative hidden w-[44%] max-w-xl flex-col justify-between overflow-hidden bg-slate-950 p-10 text-white lg:flex">
      {/* Malaking mark sa likod, dekorasyon lang */}
      <BrandMark className="pointer-events-none absolute -right-24 -bottom-24 h-[28rem] w-[28rem] text-sky-600/25" />

      <div className="relative flex items-center gap-3">
        <BrandMark className="h-10 w-10 text-sky-300" />
        <div>
          <p className="text-lg font-semibold leading-tight">DentaVault</p>
          <p className="text-sm text-slate-400">Teodosio-Rufin Dental Clinic</p>
        </div>
      </div>

      <div className="relative">
        <h2 className="text-3xl font-semibold leading-tight">
          Patient records,
          <br />
          charts, and X-rays
          <br />
          <span className="text-sky-300">in one secure place.</span>
        </h2>
        <ul className="mt-8 space-y-4">
          {HIGHLIGHTS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3 text-base text-slate-300">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-sky-300">
                <Icon className="h-5 w-5" />
              </span>
              <span className="pt-1.5">{text}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="relative text-sm text-slate-400">For clinic staff and registered patients only.</p>
    </aside>
  )
}
