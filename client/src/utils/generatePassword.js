const PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

export function generatePassword(length = 12) {
  const bytes = new Uint32Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (n) => PASSWORD_CHARS[n % PASSWORD_CHARS.length]).join('')
}
