import { useState } from 'react'
import { Columns2, Mail, UploadCloud, ScanLine, UserRound } from 'lucide-react'
import XrayThumbnail from './XrayThumbnail'
import StatusBadge from '../common/StatusBadge'
import EmptyState from '../common/EmptyState'
import { formatDate } from '../../utils/formatDate'

// Petsa ng X-ray: taken_date kung naitala, kung hindi, petsa ng upload
function xrayDate(xray) {
  return formatDate(xray.taken_date || xray.created_at)
}

// Mga X-ray na hindi ang dentist ang nag-upload: may "New" hanggang mabuksan
// niya. Sa patient, "Waiting for review" ang lumalabas (#27).
const REVIEWABLE_SOURCES = ['email_inbound', 'patient_upload']

const SOURCE_LABELS = {
  email_inbound: { icon: Mail, label: 'Email' },
  patient_upload: { icon: UserRound, label: 'Patient' },
  manual_upload: { icon: UploadCloud, label: 'Clinic' },
}

export default function XrayGallery({ xrays, onOpen, onCompare, canUpload = false, viewerRole = 'dentist' }) {
  const [selected, setSelected] = useState([])

  function toggleSelect(id) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 2) return [prev[1], id] // keep the selection to at most 2
      return [...prev, id]
    })
  }

  if (xrays.length === 0) {
    return (
      <EmptyState
        compact
        icon={ScanLine}
        title="No X-rays yet"
        description={
          !canUpload
            ? 'X-rays taken at the clinic will appear here.'
            : viewerRole === 'patient'
              ? 'X-rays from the clinic will appear here. You can also send one with the form below.'
              : 'Upload the first X-ray with the form below. X-rays the patient emails or uploads also appear here automatically.'
        }
      />
    )
  }

  return (
    <div>
      {selected.length === 2 && (
        <button
          type="button"
          onClick={() => onCompare(xrays.filter((x) => selected.includes(x.id)))}
          className="mb-3 flex min-h-11 items-center gap-2 rounded-md bg-sky-600 px-4 text-base font-semibold text-white transition-colors hover:bg-sky-700"
        >
          <Columns2 className="h-4 w-4" />
          Compare Selected
        </button>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {xrays.map((xray) => (
          <div
            key={xray.id}
            className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
          >
            <button type="button" onClick={() => onOpen(xray)} className="h-full w-full">
              <XrayThumbnail xray={xray} />
            </button>
            {/* Dati: "compare" label sa kaliwa at Email/Manual badge sa kanan,
                parehong nasa itaas — nagpapatong sila sa makitid na thumbnail.
                Ngayon: checkbox lang (44px touch target, may aria-label) sa
                itaas-kaliwa, "New" lang sa itaas-kanan (yun ang kailangang
                pansinin), at ang source ay lumipat sa bottom bar kasama ng petsa. */}
            <label
              title="Select to compare"
              className={`absolute left-1 top-1 flex h-11 w-11 cursor-pointer items-center justify-center rounded-md shadow-sm transition-colors ${
                selected.includes(xray.id) ? 'bg-sky-600' : 'bg-white/95 hover:bg-white'
              }`}
            >
              <input
                type="checkbox"
                aria-label={`Select X-ray from ${xrayDate(xray)} to compare`}
                checked={selected.includes(xray.id)}
                onChange={() => toggleSelect(xray.id)}
                className="h-5 w-5 cursor-pointer accent-sky-600"
              />
            </label>
            {REVIEWABLE_SOURCES.includes(xray.source) && !xray.reviewed_at && viewerRole !== 'patient' && (
              <div className="absolute right-1 top-1">
                <StatusBadge variant="amber">New</StatusBadge>
              </div>
            )}
            {/* Patient: buong-lapad na strip (hindi badge sa itaas-kanan) para hindi
                tumama sa compare checkbox sa makitid na thumbnail sa phone */}
            {REVIEWABLE_SOURCES.includes(xray.source) && !xray.reviewed_at && viewerRole === 'patient' && (
              <div className="absolute inset-x-0 bottom-6 bg-sky-600/90 px-2 py-0.5 text-center text-xs font-medium text-white">
                Waiting for review
              </div>
            )}
            <div className="absolute bottom-0 flex w-full items-center justify-between gap-1 bg-slate-900/75 px-2 py-1 text-xs text-white">
              <span className="truncate">{xrayDate(xray)}</span>
              <SourceLabel source={xray.source} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Saan galing ang X-ray (bottom bar ng thumbnail). Dati "Manual" ang tawag sa
// upload ng clinic; "Clinic" na, para malinaw kumpara sa "Patient".
function SourceLabel({ source }) {
  const { icon: Icon, label } = SOURCE_LABELS[source] ?? SOURCE_LABELS.manual_upload
  return (
    // Phone: icon lang (makitid ang thumbnail, para buo ang petsa); sm pataas: may salita
    <span className="flex shrink-0 items-center gap-1 text-slate-200" title={`From: ${label}`}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      <span className="sr-only sm:not-sr-only">{label}</span>
    </span>
  )
}
