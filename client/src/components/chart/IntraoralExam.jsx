import { useEffect, useId, useState } from 'react'
import { INTRAORAL_GROUPS, MOLAR_CLASSES } from '../../constants/dental'
import { getIntraoralExam, saveIntraoralExam } from '../../services/chart'
import { useToast } from '../../context/ToastContext'
import { formatDate } from '../../utils/formatDate'

const EMPTY = { items: [], molarClass: '', appliancesOther: '' }

function toForm(exam) {
  if (!exam) return EMPTY
  return {
    items: exam.findings.items || [],
    molarClass: exam.findings.molarClass || '',
    appliancesOther: exam.findings.appliancesOther || '',
  }
}

// Ang mga napili sa isang grupo bilang text (para sa view at print)
function groupSummary(group, form) {
  const parts = group.items.filter((i) => form.items.includes(i.code)).map((i) => i.label)
  if (group.code === 'occlusion' && form.molarClass) parts.unshift(`Class ${form.molarClass} (Molar)`)
  if (group.code === 'appliances' && form.appliancesOther) parts.push(form.appliancesOther)
  return parts
}

// Intraoral Examination: ibabang bahagi ng papel na chart ng clinic
// (Periodontal Screening, Occlusion, Appliances, TMD) — para sa buong bibig.
// Dentist: i-check at i-Save (lalabas ang Save kapag may binago). Patient at
// print: basa lang. `printMode`: maikling listahan para sa papel.
export default function IntraoralExam({ patientId, canEdit, printMode = false }) {
  const { showToast } = useToast()
  const formId = useId()
  const [exam, setExam] = useState(undefined) // undefined = naglo-load, null = wala pa
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getIntraoralExam(patientId)
      .then((e) => {
        setExam(e)
        setForm(toForm(e))
      })
      .catch(() => setError('Could not load the intraoral examination.'))
  }, [patientId])

  const saved = toForm(exam)
  const dirty = JSON.stringify(form) !== JSON.stringify(saved)
  const hasAny = INTRAORAL_GROUPS.some((g) => groupSummary(g, saved).length > 0)

  function toggle(code) {
    setForm((f) => ({ ...f, items: f.items.includes(code) ? f.items.filter((i) => i !== code) : [...f.items, code] }))
  }

  async function save() {
    setSaving(true)
    try {
      const e = await saveIntraoralExam(patientId, form)
      setExam(e)
      setForm(toForm(e))
      showToast('Intraoral examination saved.', { type: 'success' })
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save examination', { type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (exam === undefined) return null

  if (printMode) {
    if (!hasAny) return null
    return (
      <div className="mt-6 break-inside-avoid text-sm">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Intraoral Examination</h2>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {INTRAORAL_GROUPS.map((g) => (
            <div key={g.code}>
              <strong>{g.label}:</strong> {groupSummary(g, saved).join(', ') || '—'}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-labelledby={`${formId}-title`}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={`${formId}-title`} className="text-base font-semibold text-slate-900">
          Intraoral Examination
        </h3>
        {exam && (
          <p className="text-sm text-slate-400">
            Updated {formatDate(exam.updated_at)} by {exam.updated_by_name}
          </p>
        )}
      </div>

      {!canEdit ? (
        hasAny ? (
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {INTRAORAL_GROUPS.map((g) => (
              <div key={g.code}>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{g.label}</dt>
                <dd className="text-base text-slate-800">{groupSummary(g, saved).join(', ') || '—'}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-slate-500">Not examined yet.</p>
        )
      ) : (
        <>
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
            {INTRAORAL_GROUPS.map((g) => (
              <fieldset key={g.code}>
                <legend className="mb-1 text-sm font-semibold text-slate-700">{g.label}</legend>
                {g.code === 'occlusion' && (
                  <label className="flex min-h-11 items-center gap-3 text-base text-slate-700">
                    <span className="shrink-0">Class (Molar)</span>
                    <select
                      value={form.molarClass}
                      onChange={(e) => setForm((f) => ({ ...f, molarClass: e.target.value }))}
                      className="min-h-11 rounded-md border border-slate-300 bg-white px-2 text-base text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    >
                      <option value="">—</option>
                      {MOLAR_CLASSES.map((c) => (
                        <option key={c} value={c}>
                          Class {c}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {g.items.map((item) => (
                  <label key={item.code} className="flex min-h-11 cursor-pointer items-center gap-3 text-base text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.items.includes(item.code)}
                      onChange={() => toggle(item.code)}
                      className="h-5 w-5 accent-sky-600"
                    />
                    {item.label}
                  </label>
                ))}
                {g.code === 'appliances' && (
                  <input
                    aria-label="Other appliance"
                    placeholder="Others (specify)"
                    value={form.appliancesOther}
                    maxLength={150}
                    onChange={(e) => setForm((f) => ({ ...f, appliancesOther: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2.5 text-base text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  />
                )}
              </fieldset>
            ))}
          </div>
          {dirty && (
            <div className="mt-4 flex gap-2 sm:justify-end">
              <button
                type="button"
                onClick={() => setForm(saved)}
                className="min-h-11 whitespace-nowrap rounded-md border border-slate-300 bg-white px-4 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={save}
                className="min-h-11 flex-1 whitespace-nowrap rounded-md bg-sky-600 px-4 text-base font-semibold text-white transition-colors hover:bg-sky-700 disabled:opacity-50 sm:flex-none"
              >
                {saving ? 'Saving...' : 'Save Examination'}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
