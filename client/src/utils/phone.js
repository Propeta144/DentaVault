// Habang nagta-type sa contact number: PH mobile lang ang puwedeng mabuo.
//   09XXXXXXXXX    → 11 digits, nagsisimula sa "09"
//   +639XXXXXXXXX  → "+63" + 10 digits (13 characters)
// Digits lang (at "+" sa unahan) ang tinatanggap; hindi na makakapag-type
// lampas sa haba o ng maling simula (hal. "1", "08", "+1").
// Kapag nag-paste: tinatanggal ang espasyo/gitling ("0917 123 4567" →
// "09171234567"), at "9171234567" / "639171234567" → idinadagdag ang kulang
// na "0" / "+".
// Ang server pa rin ang huling check (PH_MOBILE_PATTERN sa patients.routes.js).

// Hanggang saan tumutugma sa inaasahang simula; ang sobra ay pinuputol
function keepPrefix(digits, prefix) {
  for (let i = 0; i < Math.min(digits.length, prefix.length); i++) {
    if (digits[i] !== prefix[i]) return digits.slice(0, i)
  }
  return digits
}

export function sanitizePhoneInput(raw) {
  const value = String(raw ?? '').trim()
  let digits = value.replace(/\D/g, '')

  if (value.startsWith('+') || digits.startsWith('6')) {
    // "+" + 639XXXXXXXXX (12 digits)
    return '+' + keepPrefix(digits, '639').slice(0, 12)
  }

  if (digits.startsWith('9')) digits = '0' + digits // "917..." → "0917..."
  return keepPrefix(digits, '09').slice(0, 11)
}
