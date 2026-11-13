import { CheckCheck } from 'lucide-react'
import StatusBadge from '../common/StatusBadge'
import { xrayReviewStatus } from '../../utils/xrayView'
import { formatDate } from '../../utils/formatDate'

export default function XrayReviewBadge({ xray, viewerRole = 'dentist' }) {
  const status = xrayReviewStatus(xray, viewerRole)
  if (!status) return null
  return (
    <span title={xray.reviewed_at ? `Reviewed ${formatDate(xray.reviewed_at)}` : 'Waiting for the dentist to open or mark this X-ray as reviewed'}>
      <StatusBadge variant={status.variant} icon={xray.reviewed_at ? CheckCheck : undefined}>{status.label}</StatusBadge>
    </span>
  )
}
