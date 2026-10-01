import { CheckCircle2, AlertTriangle, XCircle, ClipboardList } from 'lucide-react'

// Bilang + listahan ng resulta ng import. Ginagamit sa Validate/Preview
// (dry run: "will be added") at sa Complete step ("added"). Dati nasa loob
// ng ImportPatientsModal.
export function ImportCounts({ result, dryRun }) {
  const items = [
    { value: result.createdCount, label: dryRun ? 'New patients' : 'Patients added', tone: 'emerald' },
    { value: result.treatmentsAddedCount, label: dryRun ? 'Treatments' : 'Treatments added', tone: 'sky' },
    { value: result.duplicateCount, label: 'Already on file', tone: 'amber' },
    { value: result.errorCount, label: 'Rows with errors', tone: 'red' },
  ]
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700',
    sky: 'bg-sky-50 text-sky-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
  }
  return (
    <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className={`rounded-lg px-2 py-3 ${tones[item.tone]}`}>
          <div className="text-2xl font-semibold">{item.value}</div>
          <div className="text-sm">{item.label}</div>
        </div>
      ))}
    </div>
  )
}

function Group({ icon: Icon, title, tone, children }) {
  const tones = {
    emerald: 'text-emerald-700',
    sky: 'text-sky-700',
    amber: 'text-amber-700',
    red: 'text-red-700',
  }
  return (
    <div>
      <h3 className={`mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${tones[tone]}`}>
        <Icon className="h-3.5 w-3.5" />
        {title}
      </h3>
      <ul className="max-h-56 space-y-1 overflow-y-auto text-sm text-slate-600">{children}</ul>
    </div>
  )
}

export function ImportDetails({ result, dryRun, show = ['errors', 'created', 'treatments', 'duplicates'] }) {
  return (
    <div className="space-y-4">
      {show.includes('errors') && result.errors.length > 0 && (
        <Group icon={XCircle} tone="red" title={dryRun ? 'Rows that will be skipped (fix them in the file)' : 'Rows skipped'}>
          {result.errors.map((e) => (
            <li key={e.row}>
              <span className="font-medium text-slate-800">Row {e.row}:</span> {e.errors.join('; ')}
            </li>
          ))}
        </Group>
      )}
      {show.includes('created') && result.created.length > 0 && (
        <Group icon={CheckCircle2} tone="emerald" title={dryRun ? 'New patients to add' : 'Patients added'}>
          {result.created.map((c) => (
            <li key={c.row}>
              Row {c.row}: {c.name}
              {c.treatmentAdded && <span className="text-slate-400"> (with treatment)</span>}
            </li>
          ))}
        </Group>
      )}
      {show.includes('treatments') && result.treatmentsAdded.length > 0 && (
        <Group icon={ClipboardList} tone="sky" title={dryRun ? 'Treatment history to add' : 'Treatment history added'}>
          {result.treatmentsAdded.map((t) => (
            <li key={t.row}>
              Row {t.row}: {t.procedureName} for {t.name}
            </li>
          ))}
        </Group>
      )}
      {show.includes('duplicates') && result.duplicates.length > 0 && (
        <Group icon={AlertTriangle} tone="amber" title="Already on file (skipped)">
          {result.duplicates.map((d) => (
            <li key={d.row}>
              Row {d.row}: {d.name}
            </li>
          ))}
        </Group>
      )}
    </div>
  )
}
