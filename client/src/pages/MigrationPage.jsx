import { Suspense, lazy, useState } from 'react'
import { PenLine, FileSpreadsheet, ArchiveRestore } from 'lucide-react'
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
    description: 'Encode paper records one patient at a time.',
    cta: 'Start manual entry',
  },
  {
    value: 'bulk',
    icon: FileSpreadsheet,
    title: 'Bulk Import (CSV)',
    description: 'Upload a spreadsheet of many patient records at once.',
    cta: 'Import a file',
  },
]

export default function MigrationPage() {
  const [mode, setMode] = useState(null)

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
                <span className="block text-sm text-slate-500">{m.description}</span>
                <span className={`mt-2 block text-sm font-semibold ${selected ? 'text-sky-700' : 'text-slate-600'}`}>
                  {selected ? 'Selected' : m.cta}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <Suspense fallback={<PageLoader label="Loading..." />}>
        {mode === 'manual' && <LegacyTreatmentEntry />}
        {mode === 'bulk' && <BulkImportWizard />}
      </Suspense>
      {!mode && (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-base text-slate-500">
          Choose how you want to bring in the old records.
        </p>
      )}
    </div>
  )
}
