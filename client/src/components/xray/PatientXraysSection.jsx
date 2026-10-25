import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { listXrays, uploadXray } from '../../services/xrays'
import UploadXrayForm from './UploadXrayForm'
import XrayGallery from './XrayGallery'
import XrayViewer from './XrayViewer'
import CompareView from './CompareView'
import PageLoader from '../common/PageLoader'

// Patient (#27, ayon sa paper): dito nag-a-upload ng sariling X-ray (ito na
// lang ang paraan mula #32; tinanggal ang email). Lalabas agad sa record na may "Waiting for review", at
// sa X-ray Inbox ng dentist bilang "New". Puwede pa itong burahin ng patient
// hangga't hindi pa nabubuksan ng dentist.
export default function PatientXraysSection({ patientId }) {
  const { user } = useAuth()
  const isDentist = user.role === 'dentist'
  const [xrays, setXrays] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewing, setViewing] = useState(null)
  const [comparing, setComparing] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    listXrays(patientId)
      .then(setXrays)
      .catch((err) => setError(err.response?.data?.error || 'Failed to load X-rays'))
      .finally(() => setLoading(false))
  }, [patientId])

  useEffect(() => {
    load()
  }, [load])

  async function handleUpload(payload) {
    await uploadXray(patientId, payload)
    load()
  }

  if (loading) return <PageLoader label="Loading X-rays..." />

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-base text-red-700">{error}</div>
      )}

      {/* Patient: ang pagpapadala ng X-ray ang pangunahing gagawin niya rito,
          kaya nasa itaas ang form (dati nasa ilalim ng buong gallery,
          critique 2026-10-25). Dentist: gallery muna (pagbabasa ang madalas). */}
      {!isDentist && (
        <UploadXrayForm
          onUpload={handleUpload}
          title="Send an X-ray to the clinic"
          description="Upload an X-ray you had taken elsewhere. The dentist will review it. You can remove it until then if you sent the wrong file."
          successMessage="X-ray sent. It will show “Waiting for review” until the dentist opens it."
        />
      )}

      <XrayGallery xrays={xrays} onOpen={setViewing} onCompare={setComparing} canUpload viewerRole={user.role} />

      {isDentist && <UploadXrayForm onUpload={handleUpload} />}

      {viewing && (
        <XrayViewer
          xray={viewing}
          patientCode={patientId}
          canAnnotate={isDentist}
          canDelete={isDentist || (viewing.source === 'patient_upload' && !viewing.reviewed_at)}
          onClose={() => {
            setViewing(null)
            load()
          }}
        />
      )}

      {comparing && <CompareView xrays={comparing} onClose={() => setComparing(null)} />}
    </div>
  )
}
