import AppError from '../utils/AppError.js'

// Route-level gate 'to: gamitin pagkatapos ng `authenticate`. Halimbawa:
// requireRole('dentist') sa bawat write route, dahil dentist lang naman
// ang may create/update/delete access base sa RBAC model ng proposal.
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to do that', 403))
    }
    next()
  }
}

// Record-level gate 'to: pwedeng basahin ng patient yung SARILI niyang
// records lang; kay dentist naman, kahit kanino. Gamitin 'to sa loob ng
// controllers kung saan yung target patientId, malalaman lang pagkatapos
// i-parse yung request (hal. route param o row na na-fetch na sa DB),
// hindi tulad ng requireRole na alam na agad sa route-registration time.
export function canAccessPatientRecord(user, patientId) {
  if (user.role === 'dentist') return true
  return user.role === 'patient' && Number(user.patientId) === Number(patientId)
}
