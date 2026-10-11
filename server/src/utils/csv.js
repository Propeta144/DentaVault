// I-quote yung kahit anong field na may comma, quote, o newline — kung
// hindi, isang totoong address gaya ng "Bacoor City, Cavite" ang tahimik
// na magsshift sa lahat ng column pagkatapos nito, pag binuksan yung CSV
// sa spreadsheet o ni-reimport.
//
// Formula injection (security review, #26): kapag nagsisimula ang value sa
// =, +, -, @ (o tab/CR), formula ang tingin dito ng Excel at puwedeng
// tumakbo pagbukas ng file (hal. pangalan na "=HYPERLINK(...)" galing sa
// lumang import). Nilalagyan ng ' sa unahan para text lang. Hindi ginagalaw
// ang purong numero gaya ng "+639171234567" o "-5": numero lang ang
// lumalabas sa Excel, at masisira ang phone number kung lalagyan ng '.
const FORMULA_START = /^[=+\-@\t\r]/
const PLAIN_NUMBER = /^[+-]?[\d\s().]+$/

export function csvField(value) {
  let str = value === null || value === undefined ? '' : String(value)
  if (FORMULA_START.test(str) && !PLAIN_NUMBER.test(str)) {
    str = `'${str}`
  }
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}
