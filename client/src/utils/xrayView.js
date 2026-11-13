export const MIN_XRAY_ZOOM = 0.01
export const MAX_XRAY_ZOOM = 4

export function fitXrayScale(imageWidth, imageHeight, availableWidth, availableHeight) {
  if (![imageWidth, imageHeight, availableWidth, availableHeight].every((n) => Number.isFinite(n) && n > 0)) return 1
  // Fit ay base sa viewport, kahit kailangang palakihin nang higit sa 400%
  // ang maliit na source. Hiwalay ang limit ng user zoom sa initial fit.
  return Math.max(MIN_XRAY_ZOOM, Math.min(availableWidth / imageWidth, availableHeight / imageHeight))
}

export function uploadProgressPercent(event) {
  const ratio = Number.isFinite(event.progress) ? event.progress
    : Number.isFinite(event.loaded) && Number.isFinite(event.total) && event.total > 0 ? event.loaded / event.total : null
  return ratio === null ? null : Math.min(100, Math.max(0, Math.round(ratio * 100)))
}

export function xrayReviewStatus(xray, viewerRole = 'dentist') {
  if (xray.reviewed_at) return { label: 'Reviewed', variant: 'emerald' }
  if (['patient_upload', 'email_inbound'].includes(xray.source)) {
    return { label: viewerRole === 'patient' ? 'Waiting for review' : 'New', variant: 'amber' }
  }
  // Clinic uploads na walang review timestamp ay hindi pending patient submissions.
  return null
}
