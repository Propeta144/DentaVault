// Patakaran sa password (#33), pareho sa dentist at patient. Kapareho ng
// client/src/utils/passwordPolicy.js (checklist habang nagta-type); ito ang
// tunay na proteksyon, kasi puwedeng tawagin nang diretso ang API.
//
// - 12 hanggang 72 characters (72 = limit ng bcrypt; lampas doon, hindi na
//   binabasa kaya parang hindi kasama sa password)
// - may malaking titik, maliit na titik, numero, at special character
// - hindi kasama ang sariling pangalan o email, at hindi karaniwang password
export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_MAX_LENGTH = 72

// Mga salitang madaling hulaan. "Kasama" (hindi eksakto) ang tinitingnan,
// kaya bawal din ang "Password123!" at "DentaVault2026!".
const COMMON_WORDS = [
  'password', 'passw0rd', 'qwerty', 'asdfgh', 'letmein', 'welcome', 'iloveyou', 'admin',
  'dentavault', 'dentist', 'teodosio', 'rufin', 'clinic', '123456', 'abcdef',
]

// Mga bahagi ng pangalan at ng email (bago ang @) na 3+ letra
function personalWords({ email, fullName } = {}) {
  const words = []
  if (email) words.push(String(email).split('@')[0])
  if (fullName) words.push(...String(fullName).replace(/^Dr\.?\s+/i, '').split(/[\s-]+/))
  return words.map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, '')).filter((w) => w.length >= 3)
}

// Listahan ng mali (walang laman = pasado). Ang unang mensahe ang ibinabalik
// ng API bilang error.
export function passwordProblems(password, context = {}) {
  const value = String(password ?? '')
  const lower = value.toLowerCase()
  const problems = []
  if (value.length < PASSWORD_MIN_LENGTH) problems.push(`Use at least ${PASSWORD_MIN_LENGTH} characters`)
  if (value.length > PASSWORD_MAX_LENGTH) problems.push(`Use ${PASSWORD_MAX_LENGTH} characters or fewer`)
  if (!/[A-Z]/.test(value)) problems.push('Add a capital letter (A–Z)')
  if (!/[a-z]/.test(value)) problems.push('Add a small letter (a–z)')
  if (!/[0-9]/.test(value)) problems.push('Add a number (0–9)')
  if (!/[^A-Za-z0-9\s]/.test(value)) problems.push('Add a special character, such as ! @ # $ %')
  if (personalWords(context).some((w) => lower.includes(w))) problems.push('Don’t use your name or email in the password')
  if (COMMON_WORDS.some((w) => lower.includes(w))) problems.push('Avoid common words such as "password" or the clinic’s name')
  return problems
}

export function isStrongPassword(password, context) {
  return passwordProblems(password, context).length === 0
}
