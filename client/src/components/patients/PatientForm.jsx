import { cloneElement, isValidElement, useId, useState } from 'react'
import { User, Phone, ShieldAlert, ClipboardList } from 'lucide-react'
import QuickInputTextarea from '../common/QuickInputTextarea'

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  sex: 'male',
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

function validate(form) {
  const errors = {}

  if (!form.firstName.trim()) errors.firstName = 'First name is required'
  if (!form.lastName.trim()) errors.lastName = 'Last name is required'

  if (!form.dateOfBirth) {
    errors.dateOfBirth = 'Date of birth is required'
  } else if (new Date(form.dateOfBirth) > new Date()) {
    errors.dateOfBirth = 'Date of birth cannot be in the future'
  }

  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = 'Enter a valid email address'
  }

  if (!form.contactNumber.trim()) {
    errors.contactNumber = 'Contact number is required'
  } else if (!PH_MOBILE_PATTERN.test(form.contactNumber.trim())) {
    errors.contactNumber = 'Use a PH mobile format: 09XXXXXXXXX or +639XXXXXXXXX'
  }

  if (form.emergencyContactPhone && !PH_MOBILE_PATTERN.test(form.emergencyContactPhone.trim())) {
    errors.emergencyContactPhone = 'Use a PH mobile format: 09XXXXXXXXX or +639XXXXXXXXX'
  }

  return errors
}

// `required`: pulang asterisk — dati "Contact Number *" lang ang may marka,
// kahit required din ang pangalan at birthday (tignan validate() sa taas).
//
// Naka-link na ang <label> sa input (htmlFor + id, galing useId), at ang
// error message sa input (aria-describedby / aria-invalid). Dati hindi,
// kaya hindi nababasa ng screen reader kung para saan ang bawat input, at
// hindi rin napipindot ang label para i-focus ang input. Sa DOM element
// lang (input/select) idinidikit ang id; ang ibang component, as is.
function Field({ label, error, required, children }) {
  const id = useId()
  const errorId = `${id}-error`
  const control =
    isValidElement(children) && typeof children.type === 'string'
      ? cloneElement(children, {
          id,
          'aria-invalid': error ? true : undefined,
          'aria-describedby': error ? errorId : undefined,
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

export default function PatientForm({ initialValues, onSubmit, submitLabel = 'Save', onCancel, stickyFooter = false }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initialValues })
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')

    const errors = validate(form)
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    try {
      await onSubmit(form)
    } catch (err) {
      setFormError(err.response?.data?.error || 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass = (hasError) =>
    `w-full rounded-md border px-3 py-2.5 text-base text-slate-900 focus:outline-none focus:ring-2 ${
      hasError
        ? 'border-red-300 focus:ring-red-200'
        : 'border-slate-300 focus:border-sky-500 focus:ring-sky-100'
    }`

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {formError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-base text-red-700">
          {formError}
        </div>
      )}

      <SectionHeading icon={User}>Personal Information</SectionHeading>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="First Name" required error={fieldErrors.firstName}>
          <input
            className={inputClass(fieldErrors.firstName)}
            value={form.firstName}
            onChange={(e) => update('firstName', e.target.value)}
          />
        </Field>
        <Field label="Last Name" required error={fieldErrors.lastName}>
          <input
            className={inputClass(fieldErrors.lastName)}
            value={form.lastName}
            onChange={(e) => update('lastName', e.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Gender">
          <select
            className={inputClass(false)}
            value={form.sex}
            onChange={(e) => update('sex', e.target.value)}
          >
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </Field>
        <Field label="Date of Birth" required error={fieldErrors.dateOfBirth}>
          <input
            type="date"
            className={inputClass(fieldErrors.dateOfBirth)}
            value={form.dateOfBirth}
            onChange={(e) => update('dateOfBirth', e.target.value)}
          />
        </Field>
      </div>

      <SectionHeading icon={Phone}>Contact Details</SectionHeading>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Contact Number" required error={fieldErrors.contactNumber}>
          <input
            placeholder="09XXXXXXXXX"
            className={inputClass(fieldErrors.contactNumber)}
            value={form.contactNumber}
            onChange={(e) => update('contactNumber', e.target.value)}
          />
        </Field>
        <Field label="Email" error={fieldErrors.email}>
          <input
            type="email"
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
          onChange={(e) => update('address', e.target.value)}
        />
      </Field>

      <SectionHeading icon={ShieldAlert}>Emergency Contact</SectionHeading>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Contact Name">
          <input
            className={inputClass(false)}
            value={form.emergencyContactName}
            onChange={(e) => update('emergencyContactName', e.target.value)}
          />
        </Field>
        <Field label="Contact Phone" error={fieldErrors.emergencyContactPhone}>
          <input
            className={inputClass(fieldErrors.emergencyContactPhone)}
            value={form.emergencyContactPhone}
            onChange={(e) => update('emergencyContactPhone', e.target.value)}
          />
        </Field>
      </div>

      <SectionHeading icon={ClipboardList}>Medical & Dental History</SectionHeading>

      <Field>
        {/* Medical History */}
<QuickInputTextarea
  label="Medical History"
  value={form.medicalHistory}
  onChange={(val) => setForm({ ...form, medicalHistory: val })}
  presets={['None', 'Hypertension', 'Diabetes', 'Asthma']}
  placeholder="Enter medical history or select options above"
/>

{/* Allergies */}
<QuickInputTextarea
  label="Allergies"
  value={form.allergies}
  onChange={(val) => setForm({ ...form, allergies: val })}
  presets={['None', 'Penicillin', 'Latex', 'Aspirin']}
  placeholder="Enter known allergies or click None"
/>
      </Field>

      {/* stickyFooter (Register page lang): laging kita ang Save/Cancel
          habang nag-i-scroll sa mahabang form. Ang negative margins ay
          tugma sa padding ng card sa PatientRegisterPage (p-4 sa phone,
          p-6 sm pataas). Sa phone, nasa ibabaw ng bottom tab bar (4rem).
          Hindi ito ginagamit sa Edit modal (may sariling scroll ang modal). */}
      <div
        // Magkatabi ang Cancel at Save kahit sa phone (dati nakasalansan,
        // kaya ~120px ng screen ang kinakain ng sticky footer)
        className={`flex gap-2 border-t border-slate-100 pt-5 sm:justify-end ${
          stickyFooter
            ? 'sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 -mx-4 -mb-4 rounded-b-xl bg-white/95 px-4 pb-4 backdrop-blur sm:-mx-6 sm:-mb-6 sm:px-6 sm:pb-5 md:bottom-0'
            : ''
        }`}
      >
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
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
    </form>
  )
}
