import { Link } from 'react-router-dom'
import { LogIn, MapPin, Phone } from 'lucide-react'
import AuthBrandPanel, { HIGHLIGHTS } from '../components/common/AuthBrandPanel'
import logoUrl from '../assets/brand/teodosio-rufin-logo.png'
import { CLINIC_INFO } from '../constants/clinic'

// Unang page sa "/" kapag hindi naka-login. Walang password field dito (nasa
// /login na ang form): ang address na ibinibigay sa pasyente ay hindi agad
// login form, at hindi na "password-input" ang lumalabas sa VirusTotal scan
// ng main address. Ang naka-login ay diretso pa rin sa dashboard/record
// (tignan ang RootRoute sa App.jsx).
export default function WelcomePage() {
  return (
    <div className="flex min-h-screen bg-white">
      <AuthBrandPanel />

      <main className="flex flex-1 items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <img
            src={logoUrl}
            alt="Teodosio-Rufin Dental Clinic"
            className="mx-auto mb-8 h-auto w-full max-w-[18rem]"
          />

          <h1 className="text-2xl font-semibold text-slate-900">Welcome to DentaVault</h1>
          <p className="mb-6 text-base text-slate-500">
            The records system of Teodosio-Rufin Dental Clinic. Patients can view their treatment history, dental
            chart, and X‑rays, and send X‑rays to the clinic.
          </p>

          {/* Sa phone/tablet walang brand panel, kaya dito ipinapakita ang highlights */}
          <ul className="mb-6 space-y-3 lg:hidden">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-base text-slate-600">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="pt-1.5">{text}</span>
              </li>
            ))}
          </ul>

          <Link
            to="/login"
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-sky-600 py-3 text-base font-semibold text-white transition-colors hover:bg-sky-700"
          >
            <LogIn className="h-4 w-4" aria-hidden="true" />
            Sign in
          </Link>

          <div className="mt-8 border-t border-slate-200 pt-6 text-sm text-slate-500">
            <p className="font-medium text-slate-600">No account yet?</p>
            <p className="mb-3">Accounts are given by the clinic. Visit or contact the clinic to get one.</p>
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
              {CLINIC_INFO.address}
            </p>
            <ul className="mt-1">
              {CLINIC_INFO.phones.map((p) => (
                <li key={p.number} className="flex items-center gap-2">
                  <Phone className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                  <a
                    href={`tel:${p.number.replace(/\s/g, '')}`}
                    className="inline-flex min-h-11 items-center font-medium text-sky-700 hover:underline lg:min-h-8"
                  >
                    {p.number}
                  </a>
                  <span>({p.network})</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
    </div>
  )
}
