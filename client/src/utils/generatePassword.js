import { passwordProblems } from './passwordPolicy'

// Walang magkamukhang letra (I, l, O, 0, 1) kasi binabasa ito ng pasyente
// mula sa printed slip. Special characters na madaling i-type sa phone lang.
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const LOWER = 'abcdefghijkmnpqrstuvwxyz'
const DIGITS = '23456789'
const SPECIAL = '!@#$%&*?'
const ALL = UPPER + LOWER + DIGITS + SPECIAL

function randomIndex(max) {
  const [n] = crypto.getRandomValues(new Uint32Array(1))
  return n % max
}

// Laging pasado sa patakaran (#33): may tig-isa ng bawat uri, tapos ginugulo
// ang pagkakasunod. Inuulit sa napakabihirang kaso na may lumabas na salita
// gaya ng "admin".
export function generatePassword(length = 12) {
  for (;;) {
    const chars = [UPPER, LOWER, DIGITS, SPECIAL].map((set) => set[randomIndex(set.length)])
    while (chars.length < length) chars.push(ALL[randomIndex(ALL.length)])
    for (let i = chars.length - 1; i > 0; i--) {
      const j = randomIndex(i + 1)
      ;[chars[i], chars[j]] = [chars[j], chars[i]]
    }
    const password = chars.join('')
    if (passwordProblems(password).length === 0) return password
  }
}
