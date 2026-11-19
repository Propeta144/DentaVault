// Patient search matches the start of name words, including compound surnames.
// Callers select prefix mode explicitly; all user text stays in parameters.
export function patientSearchFilter({ search, searchMode } = {}) {
  const base = 'WHERE p.deleted_at IS NULL'
  if (!search) return { where: base, params: {} }
  if (searchMode !== 'name_prefix') {
    return { where: `${base} AND (CONCAT(p.first_name, ' ', p.last_name) LIKE :search)`, params: { search: `%${search}%` } }
  }

  const words = search.trim().split(/[\s,.-]+/u).filter(Boolean)
  // Punctuation-only input is not an empty/recent-patients search.
  if (!words.length) return { where: `${base} AND 1 = 0`, params: {} }
  const name = `REPLACE(REPLACE(REPLACE(CONCAT(' ', p.first_name, ' ', p.last_name), '-', ' '), '.', ' '), ',', ' ')`
  const params = {}
  const clauses = words.map((word, index) => {
    const key = `nameWord${index}`
    // Explicit escape character also works with MySQL NO_BACKSLASH_ESCAPES.
    params[key] = `% ${word.replace(/[!%_]/g, '!$&')}%`
    return `${name} LIKE :${key} ESCAPE '!'`
  })
  return { where: `${base} AND (${clauses.join(' AND ')})`, params }
}
