// I-quote yung kahit anong field na may comma, quote, o newline — kung
// hindi, isang totoong address gaya ng "Bacoor City, Cavite" ang tahimik
// na magsshift sa lahat ng column pagkatapos nito, pag binuksan yung CSV
// sa spreadsheet o ni-reimport.
export function csvField(value) {
  const str = value === null || value === undefined ? '' : String(value)
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}
