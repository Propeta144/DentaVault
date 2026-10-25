import { Suspense, lazy, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { PenLine, FileSpreadsheet, ArchiveRestore, ArrowRight, Check } from 'lucide-react'
import PageLoader from '../components/common/PageLoader'

// Lazy (Feature #9): ang napiling paraan LANG ang dina-download — hindi
// kailangan ang buong wizard kung Manual Entry ang gagamitin, at vice versa.
const BulkImportWizard = lazy(() => import('../components/migration/BulkImportWizard'))
const LegacyTreatmentEntry = lazy(() => import('../components/migration/LegacyTreatmentEntry'))

// Legacy Record Migration (Patient Records Module ng proposal): paglipat ng
// lumang papel na record (galing pa sa dating may-ari ng clinic) papunta sa
// DentaVault. Dalawang paraan, ayon sa proposal:
// - Manual Entry: isa-isang patient, i-encode ang mga lumang visit
// - Bulk Import: CSV galing spreadsheet, may Map Columns at Validate bago mag-save
// Dati: "Import" button lang sa Patients list (modal, walang preview).
const MODES = [
  {
    value: 'manual',
    icon: PenLine,
    title: 'Manual Entry',
    // Nakatuon sa papel na folder ng clinic (bolder, critique 2026-10-25)
    description: "From one patient's paper folder: their chart and past visits.",
    steps: ['Find or register the patient', 'Add each past visit', 'Save them all at once'],
    cta: 'Start manual entry',
  },
  {
    value: 'bulk',
    icon: FileSpreadsheet,
    title: 'Bulk Import (Excel or CSV)',
    description: 'For many folders typed into a spreadsheet first.',
    steps: ['Download the Excel template', 'Type one row per visit', 'Check it, then import'],
    cta: 'Import a file',
  },
]

export default function MigrationPage() {
  // Galing sa Register (Manual Entry → "Register the patient"): bukas na ang
  // Manual Entry at napili na ang bagong patient
  const location = useLocation()
  const returned = location.state?.mode === 'manual' ? location.state : null
  const [mode, setMode] = useState(returned ? 'manual' : null)

  return (
    <div>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
          <ArchiveRestore className="h-6 w-6 text-sky-600" />
          Legacy Record Migration
        </h1>
        <p className="text-base text-slate-500">Digitize and import old paper-based patient records into DentaVault.</p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2" role="radiogroup" aria-label="Migration method">
        {MODES.map((m) => {
          const selected = mode === m.value
          return (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setMode(m.value)}
              className={`flex items-start gap-4 rounded-xl border bg-white p-4 text-left shadow-sm transition-all sm:p-5 ${
                selected
                  ? 'border-sky-500 ring-2 ring-sky-100'
                  : 'border-slate-200 hover:border-slate-300 hover:shadow'
              }`}
            >
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${
                  selected ? 'bg-sky-600 text-white' : 'bg-sky-50 text-sky-600'
                }`}
              >
                <m.icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-base font-semibold text-slate-900">{m.title}</span>
                <span className="block text-sm text-slate-600">{m.description}</span>
                {/* Maikling hakbang: alam agad kung ano ang mangyayari */}
                <span className="mt-2 block space-y-0.5 text-sm text-slate-700">
                  {m.steps.map((step, i) => (
                    <span key={step} className="flex items-baseline gap-2">
                      <span className="w-4 shrink-0 text-right font-semibold tabular-nums text-sky-700">{i + 1}</span>
                      {step}
                    </span>
                  ))}
                </span>
                {/* Mukhang action (kulay ng brand + arrow), hindi plain na text
                    (critique 2026-10-25) */}
                <span className="mt-2 flex items-center gap-1 text-sm font-semibold text-sky-700">
                  {selected ? (
                    <>
                      <Check className="h-4 w-4" aria-hidden="true" />
                      Selected
                    </>
                  ) : (
                    <>
                      {m.cta}
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </>
                  )}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <Suspense fallback={<PageLoader label="Loading..." />}>
        {mode === 'manual' && <LegacyTreatmentEntry initialPatient={returned?.patient ?? null} />}
        {mode === 'bulk' && <BulkImportWizard />}
      </Suspense>
      {/* Walang placeholder na kahon kapag wala pang napili: inuulit lang
          nito ang dalawang card sa itaas (critique 2026-10-25) */}
    </div>
  )
}
