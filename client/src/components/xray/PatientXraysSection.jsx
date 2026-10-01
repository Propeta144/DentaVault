import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { listXrays, uploadXray } from '../../services/xrays'
import UploadXrayForm from './UploadXrayForm'
import XrayGallery from './XrayGallery'
import XrayViewer from './XrayViewer'
import CompareView from './CompareView'
import PageLoader from '../common/PageLoader'

export default function PatientXraysSection({ patientId }) {
  const { user } = useAuth()
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

      <XrayGallery
        xrays={xrays}
        onOpen={setViewing}
        onCompare={setComparing}
        canUpload={user.role === 'dentist'}
      />

      {user.role === 'dentist' && <UploadXrayForm onUpload={handleUpload} />}

      {viewing && (
        <XrayViewer
          xray={viewing}
          patientCode={patientId}
          canAnnotate={user.role === 'dentist'}
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
