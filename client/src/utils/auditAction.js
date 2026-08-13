// Ginagamit parehong AuditLogPage (full table) at DashboardPage (recent
// activity feed) — cosmetic grouping lang naman 'to, para scannable pa rin
// yung mahabang listahan ng action codes (CREATE_PATIENT, LOGIN_FAILED,
// DELETE_PATIENT, ...).
export function actionVariant(action) {
  if (action.includes('DELETE') || action.includes('FAILED') || action.includes('UNMATCHED')) return 'red'
  if (action.includes('CREATE') || action.includes('SUCCESS') || action.includes('IMPORT')) return 'emerald'
  if (action.includes('UPDATE') || action.includes('RESET') || action.includes('ANNOTATE') || action.includes('INBOUND')) return 'sky'
  if (action.includes('EXPORT')) return 'amber'
  return 'slate' // VIEW_*, GENERATE_*, at kahit ano pang hindi na-mention sa taas
}

// "CREATE_CHART_ENTRY" -> "Create Chart Entry" — kung hindi, raw action
// codes lang ilalagay ng action filter dropdown, parang developer's enum
// ang itsura, hindi parang bagay na pipiliin lang ng dentist sa menu.
export function humanizeAction(action) {
  return action
    .toLowerCase()
    .split('_')
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ')
}
