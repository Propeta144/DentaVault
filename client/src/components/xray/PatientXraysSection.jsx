import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { listXrays, uploadXray } from '../../services/xrays'
import UploadXrayForm from './UploadXrayForm'
import XrayGallery from './XrayGallery'
import XrayViewer from './XrayViewer'
import CompareView from './CompareView'

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

  if (loading) return <p className="text-sm text-slate-400">Loading X-rays...</p>

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <XrayGallery xrays={xrays} onOpen={setViewing} onCompare={setComparing} />

      {user.role === 'dentist' && <UploadXrayForm onUpload={handleUpload} />}

      {viewing && (
        <XrayViewer
          xray={viewing}
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
