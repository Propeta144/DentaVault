// Patakaran sa password (#33). Kapareho ng server/src/utils/passwordPolicy.js:
// ito ang checklist habang nagta-type; ang server pa rin ang huling check.
export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_MAX_LENGTH = 72

const COMMON_WORDS = [
  'password', 'passw0rd', 'qwerty', 'asdfgh', 'letmein', 'welcome', 'iloveyou', 'admin',
  'dentavault', 'dentist', 'teodosio', 'rufin', 'clinic', '123456', 'abcdef',
]

function personalWords({ email, fullName } = {}) {
  const words = []
  if (email) words.push(String(email).split('@')[0])
  if (fullName) words.push(...String(fullName).replace(/^Dr\.?\s+/i, '').split(/[\s-]+/))
  return words.map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, '')).filter((w) => w.length >= 3)
}

// Bawat patakaran: { key, label (checklist), message (error), ok(value, context) }
export const PASSWORD_RULES = [
  {
    key: 'length',
    label: `At least ${PASSWORD_MIN_LENGTH} characters`,
    message: `Use at least ${PASSWORD_MIN_LENGTH} characters`,
    ok: (v) => v.length >= PASSWORD_MIN_LENGTH && v.length <= PASSWORD_MAX_LENGTH,
  },
  { key: 'upper', label: 'A capital letter (A–Z)', message: 'Add a capital letter (A–Z)', ok: (v) => /[A-Z]/.test(v) },
  { key: 'lower', label: 'A small letter (a–z)', message: 'Add a small letter (a–z)', ok: (v) => /[a-z]/.test(v) },
  { key: 'number', label: 'A number (0–9)', message: 'Add a number (0–9)', ok: (v) => /[0-9]/.test(v) },
  {
    key: 'special',
    label: 'A symbol (! @ # $ %)',
    message: 'Add a special character, such as ! @ # $ %',
    ok: (v) => /[^A-Za-z0-9\s]/.test(v),
  },
  {
    key: 'personal',
    label: 'Not your name, email, or a common word',
    message: 'Don’t use your name, email, or common words such as "password" or the clinic’s name',
    ok: (v, context) => {
      const lower = v.toLowerCase()
      return v.length > 0 && ![...personalWords(context), ...COMMON_WORDS].some((w) => lower.includes(w))
    },
  },
]

export function passwordProblems(password, context = {}) {
  const value = String(password ?? '')
  return PASSWORD_RULES.filter((r) => !r.ok(value, context)).map((r) => r.message)
}
