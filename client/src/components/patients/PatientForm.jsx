import { cloneElement, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { User, Phone, ShieldAlert, ClipboardList, Users, ExternalLink } from 'lucide-react'
import QuickInputTextarea from '../common/QuickInputTextarea'
import DiscardChangesBar from '../common/DiscardChangesBar'
import { FIELD_LIMITS } from '../../constants/fieldLimits'
import { formatDate, todayISO } from '../../utils/formatDate'
import { getEmailUsage } from '../../services/patients'
import { listName } from '../../utils/patientName'

// Walang default ang `sex` (dati "male" na agad): kapag nakalimutang
// palitan, mali ang record nang walang babala. Required na ito.
const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  sex: '',
  dateOfBirth: '',
  contactNumber: '',
  email: '',
  address: '',
  medicalHistory: '',
  allergies: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
}

// PH mobile format lang: 09XXXXXXXXX (11 digits) o +639XXXXXXXXX. Tugma 'to
// sa server-side rule sa patients.routes.js — ito dito, mas mabilis lang
// yung feedback; yung sa server yung talagang hindi mabibypass.
const PH_MOBILE_PATTERN = /^(09\d{9}|\+639\d{9})$/

// "0917 123 4567" / "0917-123-4567" → "09171234567" (parehong panuntunan ng
// server: stripPhoneFormatting sa server/src/utils/validators.js)
const cleanPhone = (value) => value.replace(/[\s\-().]/g, '')

function validate(form) {
  const errors = {}

  if (!form.firstName.trim()) errors.firstName = 'First name is required'
  if (!form.lastName.trim()) errors.lastName = 'Last name is required'
  if (!form.sex) errors.sex = 'Select the patient’s sex'

  if (!form.dateOfBirth) {
    errors.dateOfBirth = 'Date of birth is required'
  } else if (form.dateOfBirth > todayISO()) {
    errors.dateOfBirth = 'Date of birth cannot be in the future'
  }

  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    errors.email = 'Enter a valid email address'
  }

  if (!form.contactNumber.trim()) {
    errors.contactNumber = 'Contact number is required'
  } else if (!PH_MOBILE_PATTERN.test(cleanPhone(form.contactNumber))) {
    errors.contactNumber = 'Use a PH mobile number: 09XX XXX XXXX or +639XX XXX XXXX'
  }

  if (form.emergencyContactPhone && !PH_MOBILE_PATTERN.test(cleanPhone(form.emergencyContactPhone))) {
    errors.emergencyContactPhone = 'Use a PH mobile number: 09XX XXX XXXX or +639XX XXX XXXX'
  }

  // Kaligtasan ng pasyente: blangko = hindi alam kung "walang allergy" o
  // "hindi natanong". Kailangang sagutin.
  if (!form.allergies.trim()) {
    errors.allergies = 'Required. Choose "None" if the patient has no known allergies.'
  }

  return errors
}

// `required`: pulang asterisk. Naka-link ang <label> sa input (htmlFor + id,
// galing useId), at ang error/hint sa input (aria-describedby /
// aria-invalid), para sa screen reader at para mapindot ang label para
// i-focus ang input. Sa DOM element lang (input/select) idinidikit ang id.
// `hint`: maikling gabay sa ilalim (hal. format ng numero) — mas
// maaasahan kaysa placeholder, na nawawala kapag nagta-type na.
function Field({ label, error, required, hint, children }) {
  const id = useId()
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = [error && errorId, hint && hintId].filter(Boolean).join(' ') || undefined
  const control =
    isValidElement(children) && typeof children.type === 'string'
      ? cloneElement(children, {
          id,
          'aria-invalid': error ? true : undefined,
          'aria-describedby': describedBy,
          'aria-required': required ? true : undefined,
        })
      : children
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-base font-medium text-slate-700">
        {label}
        {required && (
          <span className="ml-0.5 text-red-600" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {control}
      {hint && !error && (
        <p id={hintId} className="mt-1 text-sm text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}

function SectionHeading({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-2 border-b border-slate-200 pb-2 pt-2 first:pt-0">
      <Icon className="h-4 w-4 text-sky-600" />
      <h3 className="text-base font-semibold text-slate-900">{children}</h3>
    </div>
  )
}

// Sex: dalawang malaking button (radio group) imbes na dropdown na may
// default — kita agad kung napili na, at isang tap lang.
function SexPicker({ value, onChange, error }) {
  const labelId = useId()
  const errorId = `${labelId}-error`
  return (
    <div>
      <p id={labelId} className="mb-1 block text-base font-medium text-slate-700">
        Sex
        <span className="ml-0.5 text-red-600" aria-hidden="true">
          *
        </span>
      </p>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        aria-required="true"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        data-field="sex"
        className="grid grid-cols-2 gap-2"
      >
        {[
          ['female', 'Female'],
          ['male', 'Male'],
        ].map(([optionValue, optionLabel]) => {
          const checked = value === optionValue
          return (
            <button
              key={optionValue}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => onChange(optionValue)}
              className={`min-h-11 rounded-md border px-3 text-base font-medium transition-colors ${
                checked
                  ? 'border-sky-500 bg-sky-50 text-sky-800 ring-1 ring-sky-500'
                  : error
                    ? 'border-red-300 bg-white text-slate-700 hover:bg-slate-50'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {optionLabel}
            </button>
          )
        })}
      </div>
      {error && (
        <p id={errorId} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}

// Props:
// - guard: galing useDiscardGuard (babala bago mawala ang binago). Kapag
//   meron, ito ang tinatawag ng Cancel at dito nanggagaling ang dirty.
// - onOpenExisting(patientCode): para sa duplicate warning (Register lang)
// - stickyFooter: Register page lang (laging kita ang Save/Cancel)
// - patientCode: Edit lang — para hindi isama ang sarili sa "shared email" check
// onSubmit(form, { allowDuplicate }) — ang form ay may malinis nang
// contact numbers (walang espasyo/gitling).
export default function PatientForm({
  initialValues,
  onSubmit,
  submitLabel = 'Save',
  onCancel,
  guard,
  onOpenExisting,
  stickyFooter = false,
  patientCode,
}) {
  const [initial] = useState(() => ({ ...EMPTY_FORM, ...initialValues }))
  const [form, setForm] = useState(initial)
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [duplicate, setDuplicate] = useState(null) // { patientCode }
  const [submitting, setSubmitting] = useState(false)
  const [submitAttempt, setSubmitAttempt] = useState(0)
  const formRef = useRef(null)
  const [sharedWith, setSharedWith] = useState([]) // ibang patient na may parehong email

  // Babala (hindi bawal): kapag may ibang patient na may ganitong email (hal.
  // magulang at mga anak), ang X-ray na ipapadala mula rito ay hindi na
  // awtomatikong mafa-file — ang dentist ang pipili sa X-ray Inbox. Sinusuri
  // 500ms pagkatapos huminto mag-type.
  const emailToCheck = form.email.trim()
  useEffect(() => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailToCheck)) {
      setSharedWith([])
      return undefined
    }
    let cancelled = false
    const timer = setTimeout(() => {
      getEmailUsage(emailToCheck, patientCode)
        .then((patients) => !cancelled && setSharedWith(patients))
        .catch(() => !cancelled && setSharedWith([])) // babala lang; hindi dapat humarang
    }, 500)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [emailToCheck, patientCode])

  const dirty = JSON.stringify(form) !== JSON.stringify(initial)
  const setDirty = guard?.setDirty
  // useLayoutEffect (hindi useEffect): naiuulat ang "may binago" bago pa
  // makapindot ng Escape/Cancel, kahit sa mismong sandali pagkatapos mag-type
  useLayoutEffect(() => {
    setDirty?.(dirty)
  }, [dirty, setDirty])

  // Pagkatapos ng submit na may mali: i-scroll at i-focus ang UNANG mali.
  // Dati, kapag pinindot ang (sticky) Register habang nasa ibaba, lumalabas
  // ang mga error sa itaas — wala sa screen, kaya parang walang nangyari.
  useEffect(() => {
    if (!submitAttempt || !formRef.current) return
    const first = formRef.current.querySelector('[aria-invalid="true"]')
    if (!first) return
    first.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const focusTarget = first.getAttribute('role') === 'radiogroup' ? first.querySelector('button') : first
    focusTarget?.focus({ preventScroll: true })
  }, [submitAttempt])

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setDuplicate(null)
    if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  async function submit({ allowDuplicate = false } = {}) {
    setFormError('')
    const errors = validate(form)
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) {
      setSubmitAttempt((n) => n + 1)
      return
    }

    const cleaned = {
      ...form,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      contactNumber: cleanPhone(form.contactNumber),
      emergencyContactPhone: cleanPhone(form.emergencyContactPhone),
    }

    setSubmitting(true)
    try {
      await onSubmit(cleaned, { allowDuplicate })
      setDirty?.(false) // naka-save na: walang babala sa pag-alis
    } catch (err) {
      if (err.response?.status === 409 && err.response.data?.duplicate) {
        setDuplicate(err.response.data.duplicate)
      } else {
        setFormError(err.response?.data?.error || 'Something went wrong')
      }
    } finally {
      setSubmitting(false)
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    submit()
  }

  const inputClass = (hasError) =>
    `w-full rounded-md border px-3 py-2.5 text-base text-slate-900 focus:outline-none focus:ring-2 ${
      hasError ? 'border-red-300 focus:ring-red-200' : 'border-slate-300 focus:border-sky-500 focus:ring-sky-100'
    }`

  const cancel = guard ? guard.requestClose : onCancel

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-5" noValidate>
      <SectionHeading icon={User}>Personal Information</SectionHeading>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="First Name" required error={fieldErrors.firstName}>
          <input
            className={inputClass(fieldErrors.firstName)}
            value={form.firstName}
            maxLength={FIELD_LIMITS.firstName}
            autoComplete="off"
            autoCapitalize="words"
            onChange={(e) => update('firstName', e.target.value)}
          />
        </Field>
        <Field label="Last Name" required error={fieldErrors.lastName}>
          <input
            className={inputClass(fieldErrors.lastName)}
            value={form.lastName}
            maxLength={FIELD_LIMITS.lastName}
            autoComplete="off"
            autoCapitalize="words"
            onChange={(e) => update('lastName', e.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SexPicker value={form.sex} onChange={(v) => update('sex', v)} error={fieldErrors.sex} />
        <Field label="Date of Birth" required error={fieldErrors.dateOfBirth}>
          <input
            type="date"
            max={todayISO()}
            className={inputClass(fieldErrors.dateOfBirth)}
            value={form.dateOfBirth}
            onChange={(e) => update('dateOfBirth', e.target.value)}
          />
        </Field>
      </div>

      <SectionHeading icon={Phone}>Contact Details</SectionHeading>

      {/* autoComplete="off" sa mga detalye ng PATIENT: ang dentist ang
          nagta-type, kaya ayaw nating i-suggest ng browser ang sariling
          pangalan/numero ng dentist. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Contact Number" required error={fieldErrors.contactNumber} hint="PH mobile, e.g. 0917 123 4567">
          <input
            type="tel"
            inputMode="tel"
            placeholder="09XX XXX XXXX"
            maxLength={FIELD_LIMITS.contactNumber}
            autoComplete="off"
            className={inputClass(fieldErrors.contactNumber)}
            value={form.contactNumber}
            onChange={(e) => update('contactNumber', e.target.value)}
          />
        </Field>
        <Field
          label="Email"
          error={fieldErrors.email}
          hint={
            sharedWith.length > 0 && (
              <span className="text-amber-700">
                Also on {sharedWith.slice(0, 3).map(listName).join('; ')}
                {sharedWith.length > 3 ? ` and ${sharedWith.length - 3} more` : ''}. X-rays emailed from this address
                will wait in the X-ray Inbox for you to choose the patient.
              </span>
            )
          }
        >
          <input
            type="email"
            inputMode="email"
            maxLength={FIELD_LIMITS.email}
            autoComplete="off"
            autoCapitalize="none"
            className={inputClass(fieldErrors.email)}
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
          />
        </Field>
      </div>

      <Field label="Address">
        <input
          className={inputClass(false)}
          value={form.address}
          maxLength={FIELD_LIMITS.address}
          autoComplete="off"
          onChange={(e) => update('address', e.target.value)}
        />
      </Field>

      <SectionHeading icon={ShieldAlert}>Emergency Contact</SectionHeading>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Contact Name" hint="Include the relationship, e.g. Rosa Dela Cruz (Wife)">
          <input
            className={inputClass(false)}
            value={form.emergencyContactName}
            maxLength={FIELD_LIMITS.emergencyContactName}
            autoComplete="off"
            autoCapitalize="words"
            onChange={(e) => update('emergencyContactName', e.target.value)}
          />
        </Field>
        <Field label="Contact Phone" error={fieldErrors.emergencyContactPhone}>
          <input
            type="tel"
            inputMode="tel"
            placeholder="09XX XXX XXXX"
            maxLength={FIELD_LIMITS.emergencyContactPhone}
            autoComplete="off"
            className={inputClass(fieldErrors.emergencyContactPhone)}
            value={form.emergencyContactPhone}
            onChange={(e) => update('emergencyContactPhone', e.target.value)}
          />
        </Field>
      </div>

      <SectionHeading icon={ClipboardList}>Medical & Dental History</SectionHeading>

      {/* Dati nakabalot ito sa <Field> na walang label, kaya may bakanteng
          <label> sa page. May sariling label/id na ang QuickInputTextarea. */}
      <QuickInputTextarea
        label="Medical History"
        value={form.medicalHistory}
        onChange={(val) => update('medicalHistory', val)}
        presets={['None', 'Hypertension', 'Diabetes', 'Asthma']}
        placeholder="Enter medical history or tap an option above"
        maxLength={FIELD_LIMITS.medicalHistory}
      />

      <QuickInputTextarea
        label="Allergies"
        required
        error={fieldErrors.allergies}
        value={form.allergies}
        onChange={(val) => update('allergies', val)}
        presets={['None', 'Penicillin', 'Latex', 'Aspirin']}
        placeholder="List known allergies, or tap None"
        maxLength={FIELD_LIMITS.allergies}
      />

      {/* stickyFooter (Register page lang): laging kita ang Save/Cancel
          habang nag-i-scroll sa mahabang form. Ang negative margins ay
          tugma sa padding ng card sa PatientRegisterPage (p-4 sa phone,
          p-6 sm pataas). Sa phone, nasa ibabaw ng bottom tab bar (4rem).
          Dito rin lumalabas ang server error at duplicate warning, para
          kita kahit nasa ibaba ng form (dati nasa itaas ang error). */}
      <div
        className={`space-y-3 border-t border-slate-100 pt-5 ${
          stickyFooter
            ? 'sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 -mx-4 -mb-4 rounded-b-xl bg-white/95 px-4 pb-4 backdrop-blur sm:-mx-6 sm:-mb-6 sm:px-6 sm:pb-5 lg:bottom-0'
            : ''
        }`}
      >
        {formError && (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-base text-red-700">
            {formError}
          </div>
        )}

        {duplicate ? (
          <div role="alert" className="space-y-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-base text-amber-900">
            <p className="flex items-start gap-2">
              <Users className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong>
                  {form.firstName.trim()} {form.lastName.trim()}
                </strong>
                , born {formatDate(form.dateOfBirth)}, is already registered. Open the existing record instead?
              </span>
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              {onOpenExisting && (
                <button
                  type="button"
                  onClick={() => onOpenExisting(duplicate.patientCode)}
                  className="flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-sky-600 px-4 text-base font-semibold text-white transition-colors hover:bg-sky-700"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open existing record
                </button>
              )}
              <button
                type="button"
                disabled={submitting}
                onClick={() => submit({ allowDuplicate: true })}
                className="min-h-11 flex-1 whitespace-nowrap rounded-md border border-amber-300 bg-white px-4 text-base font-medium text-amber-900 transition-colors hover:bg-amber-100 disabled:opacity-50"
              >
                {submitting ? 'Saving...' : 'Different person, register anyway'}
              </button>
            </div>
          </div>
        ) : guard?.confirming ? (
          <DiscardChangesBar guard={guard} />
        ) : (
          // Magkatabi ang Cancel at Save kahit sa phone; natural na lapad
          // ang Cancel, ang Save ang kumukuha ng natitira.
          <div className="flex gap-2 sm:justify-end">
            {cancel && (
              <button
                type="button"
                onClick={cancel}
                className="flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-md border border-slate-300 bg-white px-4 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50 sm:px-5"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="flex min-h-11 flex-1 items-center justify-center whitespace-nowrap rounded-md bg-sky-600 px-4 text-base font-semibold text-white transition-colors hover:bg-sky-700 disabled:opacity-50 sm:flex-none sm:px-5"
            >
              {submitting ? 'Saving...' : submitLabel}
            </button>
          </div>
        )}
      </div>
    </form>
  )
}
