import { format, formatDistanceToNowStrict, isToday, isYesterday, differenceInCalendarDays } from 'date-fns'

// Iisang format ng petsa sa buong app. Dati tatlo ang itsura: "1990-05-14"
// (profile), "7/22/2026" (patient list), at "Oct 1, 7:34 PM" (dashboard).
//
// Dalawang uri ng value ang dumarating galing sa API:
// - DATE columns (date_of_birth, treatment_date, taken_date): plain
//   "YYYY-MM-DD" string (tignan ang dateStrings sa server/src/config/db.js).
//   HUWAG i-`new Date("1990-05-14")`: UTC midnight ang basa doon, kaya sa
//   timezone na negative ang offset, lalabas na isang araw na mas maaga.
//   Kaya hinahati namin sa year/month/day at ginagawang LOCAL na petsa.
// - DATETIME columns (created_at): buong ISO timestamp, ligtas sa new Date().
function toDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (dateOnly) return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

// Petsa NGAYON sa oras ng device (YYYY-MM-DD) — para sa default ng date
// inputs at `max` (bawal ang future). HUWAG `new Date().toISOString()`:
// UTC iyon, kaya bago mag-8 AM sa Pilipinas, kahapon ang lumalabas.
export function todayISO() {
  return format(new Date(), 'yyyy-MM-dd')
}

// "Oct 1, 2026"
export function formatDate(value, fallback = '—') {
  const date = toDate(value)
  return date ? format(date, 'MMM d, yyyy') : fallback
}

// "Oct 1, 2026, 7:34 PM"
export function formatDateTime(value, fallback = '—') {
  const date = toDate(value)
  return date ? format(date, 'MMM d, yyyy, h:mm a') : fallback
}

// "Today, 7:34 PM" / "Yesterday, 7:34 PM" / "Sep 28, 7:34 PM" (parehong
// taon) / "Sep 28, 2025" (ibang taon). Para sa activity feeds kung saan
// mas mahalaga ang "kailan" kaysa eksaktong petsa.
export function formatActivityTime(value) {
  const date = toDate(value)
  if (!date) return '—'
  if (isToday(date)) return `Today, ${format(date, 'h:mm a')}`
  if (isYesterday(date)) return `Yesterday, ${format(date, 'h:mm a')}`
  if (date.getFullYear() === new Date().getFullYear()) return format(date, 'MMM d, h:mm a')
  return format(date, 'MMM d, yyyy')
}

// "Today" / "Yesterday" / "5 days ago" / "3 months ago" — para sa "Last
// visit". Petsa lang (walang oras) ang treatment_date, kaya calendar days
// ang binibilang, hindi oras.
export function formatRelativeDay(value, fallback = '—') {
  const date = toDate(value)
  if (!date) return fallback
  const days = differenceInCalendarDays(new Date(), date)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days > 1 && days < 7) return `${days} days ago`
  return formatDistanceToNowStrict(date, { addSuffix: true })
}

// Edad base sa birthday, tama kahit hindi pa sumasapit ang birthday ngayong
// taon. (Ang dating calculateAge sa PatientsListPage ay tantiya gamit ang
// milliseconds, kaya puwedeng magkamali ng isang taon malapit sa birthday
// dahil sa leap years.)
export function calculateAge(dateOfBirth) {
  const dob = toDate(dateOfBirth)
  if (!dob) return null
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const hadBirthdayThisYear =
    today.getMonth() > dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate())
  if (!hadBirthdayThisYear) age -= 1
  return age
}

// Para sa "Good morning, Dr. ..." sa Dashboard.
export function greetingForNow(now = new Date()) {
  const hour = now.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}
