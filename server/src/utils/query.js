// Ligtas na pagbasa ng query string (security review, #26). Kapag inulit ang
// parameter (?search=a&search=b) o may brackets (?search[]=a), array o object
// ang ibinibigay ng Express sa halip na string, kaya pumapalya ang `.trim()`
// at 500 ang lumalabas. Text lang ang tinatanggap; kung hindi, parang wala.
export function queryText(value) {
  return typeof value === 'string' ? value.trim() : undefined
}

// Page/limit: laging buong numero sa loob ng [min, max]; default kapag
// wala o hindi numero.
export function queryInt(value, { min, max, fallback }) {
  const n = Math.trunc(Number(queryText(value)))
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}
