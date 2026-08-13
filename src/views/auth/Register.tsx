import { useState } from 'react'
import type {
  FormEvent,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  Eye,
  EyeOff,
  HeartPulse,
  Lock,
  Mail,
  MapPin,
  Phone,
  PhoneCall,
  Ruler,
  User,
  Users,
  Weight,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  API_ENDPOINTS,
  apiClient,
  ApiError,
  normalizeStoredUser,
  setStoredPatient,
  setStoredUser,
  tokenStorage,
} from '../../api/apiClient'
import type {
  BloodGroup,
  RegisterRequest,
  RegisterResponse,
  Relationship,
} from '../../types/auth.types'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_MIN_LENGTH = 8

const bloodTypes: BloodGroup[] = [
  'O+',
  'O-',
  'A+',
  'A-',
  'B+',
  'B-',
  'AB+',
  'AB-',
]

const genders: { value: string; label: string }[] = [
  { value: 'Male', label: 'Masculino' },
  { value: 'Female', label: 'Femenino' },
  { value: 'Other', label: 'Otro' },
]

const relationships: { value: Relationship; label: string }[] = [
  { value: 'spouse', label: 'Cónyuge / Pareja' },
  { value: 'hijo/a', label: 'Hijo/a' },
  { value: 'padre/madre', label: 'Padre / Madre' },
  { value: 'otro', label: 'Otro' },
]

function parseNumberOrNull(value: string): number | null {
  const normalized = value.trim().replace(',', '.')
  if (normalized === '') {
    return null
  }
  const parsed = Number(normalized)
  return Number.isNaN(parsed) ? null : parsed
}

interface FormFieldProps {
  htmlFor: string
  label: string
  error?: string
  children: ReactNode
}

function FormField({ htmlFor, label, error, children }: FormFieldProps) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-slate-700"
      >
        {label}
      </label>
      <div className="relative mt-1.5">{children}</div>
      {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : null}
    </div>
  )
}

interface IconInputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon: LucideIcon
  trailing?: ReactNode
}

function IconInput({ icon: Icon, trailing, ...rest }: IconInputProps) {
  return (
    <>
      <Icon
        className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400"
        aria-hidden="true"
      />
      <input
        {...rest}
        className={`w-full rounded-lg border border-slate-300 py-2.5 pl-10 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 ${
          trailing ? 'pr-12' : 'pr-4'
        }`}
      />
      {trailing ? (
        <div className="absolute inset-y-0 right-0 flex items-center pr-2.5">
          {trailing}
        </div>
      ) : null}
    </>
  )
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  children: ReactNode
}

function Select({ children, ...rest }: SelectProps) {
  return (
    <select
      {...rest}
      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 pr-8 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
    >
      {children}
    </select>
  )
}

interface SectionCardProps {
  icon: LucideIcon
  title: string
  children: ReactNode
}

function SectionCard({ icon: Icon, title, children }: SectionCardProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
      <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-blue-900">
        <span className="flex size-7 items-center justify-center rounded-lg bg-blue-600">
          <Icon className="size-4 text-white" aria-hidden="true" />
        </span>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

interface FormErrors {
  caregiverName?: string
  patientName?: string
  email?: string
  password?: string
  age?: string
  weight?: string
  height?: string
  terms?: string
  form?: string
}

export default function Register() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedPlan = searchParams.get('plan')
  const sessionPlan =
    requestedPlan === 'premium' || requestedPlan === 'gold' ? 'premium' : 'basic'

  const [caregiverName, setCaregiverName] = useState('')
  const [patientName, setPatientName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [gender, setGender] = useState('Male')
  const [age, setAge] = useState('')
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')
  const [address, setAddress] = useState('')
  const [bloodType, setBloodType] = useState<BloodGroup>('O+')

  const [emergencyName, setEmergencyName] = useState('')
  const [emergencyRelationship, setEmergencyRelationship] =
    useState<Relationship>('otro')
  const [emergencyPhone, setEmergencyPhone] = useState('')
  const [emergencyEmail, setEmergencyEmail] = useState('')

  const [acceptTerms, setAcceptTerms] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)

  const validate = (): FormErrors => {
    const next: FormErrors = {}
    if (!caregiverName.trim()) {
      next.caregiverName = 'Ingrese el nombre del cuidador.'
    }
    if (!patientName.trim()) {
      next.patientName = 'Ingrese el nombre del paciente.'
    }
    if (!email.trim()) {
      next.email = 'El correo electrónico es obligatorio.'
    } else if (!EMAIL_REGEX.test(email.trim())) {
      next.email = 'Ingrese un correo electrónico válido.'
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      next.password = `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`
    }
    const ageNumber = parseNumberOrNull(age)
    if (age.trim() !== '' && (ageNumber === null || ageNumber < 1 || ageNumber > 120)) {
      next.age = 'Ingrese una edad válida.'
    }
    const weightNumber = parseNumberOrNull(weight)
    if (weight.trim() !== '' && (weightNumber === null || weightNumber < 1)) {
      next.weight = 'Ingrese un peso válido.'
    }
    const heightNumber = parseNumberOrNull(height)
    if (
      height.trim() !== '' &&
      (heightNumber === null || heightNumber < 0.1 || heightNumber > 2.5)
    ) {
      next.height = 'Ingrese una estatura válida (en metros).'
    }
    if (!acceptTerms) {
      next.terms = 'Debe aceptar los términos y condiciones.'
    }
    return next
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const validation = validate()
    setErrors(validation)
    if (Object.keys(validation).length > 0) {
      return
    }

    setSubmitting(true)
    try {
      // Payload exacto de POST /api/auth/register: firstName/lastName son los
      // del cuidador/usuario; el resto de los campos del paciente viajan como
      // perfil clínico plano.
      const caregiverNameParts = caregiverName.trim().split(' ')
      const payload: RegisterRequest = {
        email: email.trim(),
        password,
        firstName: caregiverNameParts[0] || caregiverName.trim(),
        lastName: caregiverNameParts.slice(1).join(' '),
        phone: phone.trim(),
        age: parseNumberOrNull(age),
        gender,
        weight: parseNumberOrNull(weight),
        height: parseNumberOrNull(height),
        bloodType,
        address: address.trim() || null,
        emergencyContactName: emergencyName.trim() || null,
        emergencyRelationship,
        emergencyPhone: emergencyPhone.trim() || null,
        emergencyEmail: emergencyEmail.trim() || null,
      }

      const response = await apiClient.post<RegisterResponse>(
        API_ENDPOINTS.auth.register,
        payload,
        { skipAuthRedirect: true },
      )

      if (response?.token) {
        tokenStorage.set(response.token)
        const sessionUser = normalizeStoredUser(response) ?? {
          id: 'local-user',
          firstName: payload.firstName,
          lastName: payload.lastName,
          email: payload.email,
          role: 'Nurse' as const,
          plan: sessionPlan,
        }
        // Persistencia del paciente/tutor en la sesión para que no se pierda
        // al navegar o actualizar la página. `setStoredPatient` además escribe
        // el respaldo por usuario en `localStorage`. El contacto de emergencia
        // se guarda explícitamente tanto en el perfil del cuidador como en el
        // paciente para que el dashboard lo muestre desde el primer segundo.
        const patientNameParts = patientName.trim().split(' ').filter(Boolean)
        const storedEmergencyContactName = emergencyName.trim() || null
        const storedEmergencyContactPhone = emergencyPhone.trim() || null
        setStoredUser({
          ...sessionUser,
          emergencyContactName: storedEmergencyContactName,
          emergencyContactPhone: storedEmergencyContactPhone,
        })
        setStoredPatient({
          firstName: patientNameParts[0] ?? '',
          lastName: patientNameParts.slice(1).join(' ') || '',
          emergencyContactName: storedEmergencyContactName,
          emergencyContactPhone: storedEmergencyContactPhone,
        })
        navigate(
          sessionPlan === 'premium' ? '/dashboard-premium' : '/dashboard',
          { replace: true },
        )
      } else {
        navigate('/auth/login', { replace: true, state: { registered: true } })
      }
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors({ form: error.message })
      } else {
        setErrors({ form: 'Ocurrió un error inesperado. Intente nuevamente.' })
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-2">
      <div className="h-screen overflow-y-auto px-8 py-10 lg:px-12">
        <Link to="/" className="inline-flex items-center gap-2 self-start">
          <span className="flex size-9 items-center justify-center rounded-full bg-blue-600">
            <HeartPulse className="size-5 text-white" aria-hidden="true" />
          </span>
          <span className="text-lg font-bold tracking-tight text-slate-900">
            Heart-Check
          </span>
        </Link>

        <div className="mt-8 flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-600">
            <BadgeCheck className="size-5 text-white" aria-hidden="true" />
          </span>
          <div className="flex-1">
            <p className="text-xs text-slate-500">Paso 1 · Completado</p>
            <p className="text-sm font-semibold text-slate-800">
              Tu Cuenta (Cuidador)
            </p>
          </div>

          <div className="mx-2 h-0.5 flex-1 rounded bg-blue-200" aria-hidden="true" />

          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-950">
            <span className="text-sm font-bold text-white">2</span>
          </span>
          <div className="flex-1">
            <p className="text-xs text-slate-500">Paso 2 · Actual</p>
            <p className="text-sm font-semibold text-slate-800">
              Perfil Paciente y Salud
            </p>
          </div>
        </div>

        <div className="mt-6">
          <h1 className="text-3xl font-bold text-blue-950">Crea tu cuenta</h1>
          <p className="mt-2 text-slate-500">
            Completa la información clínica del paciente para personalizar el
            monitoreo.
          </p>
        </div>

        {errors.form && (
          <div
            role="alert"
            className="mt-6 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800"
          >
            {errors.form}
          </div>
        )}

        <form
          onSubmit={(event) => void handleSubmit(event)}
          noValidate
          className="mt-6 space-y-6"
        >
          <SectionCard icon={User} title="Datos del Cuidador y Paciente">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  htmlFor="caregiverName"
                  label="Nombre del Cuidador"
                  error={errors.caregiverName}
                >
                  <IconInput
                    id="caregiverName"
                    icon={User}
                    value={caregiverName}
                    onChange={(event) => setCaregiverName(event.target.value)}
                    placeholder="Ej. Nombre Apellido"
                  />
                </FormField>
                <FormField
                  htmlFor="patientName"
                  label="Nombre del Paciente"
                  error={errors.patientName}
                >
                  <IconInput
                    id="patientName"
                    icon={Users}
                    value={patientName}
                    onChange={(event) => setPatientName(event.target.value)}
                    placeholder="Ej. Nombre Apellido"
                  />
                </FormField>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField htmlFor="email" label="Correo electrónico" error={errors.email}>
                  <IconInput
                    id="email"
                    icon={Mail}
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="nombre@ejemplo.com"
                  />
                </FormField>
                <FormField htmlFor="phone" label="Teléfono">
                  <IconInput
                    id="phone"
                    icon={Phone}
                    type="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="+52 55 0000 0000"
                  />
                </FormField>
              </div>

              <FormField htmlFor="password" label="Contraseña" error={errors.password}>
                <IconInput
                  id="password"
                  icon={Lock}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  trailing={
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={
                        showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
                      }
                      className="rounded-md p-1 text-slate-400 transition-colors hover:text-slate-600"
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" aria-hidden="true" />
                      ) : (
                        <Eye className="size-4" aria-hidden="true" />
                      )}
                    </button>
                  }
                />
              </FormField>
            </div>
          </SectionCard>

          <SectionCard icon={Activity} title="Métricas Físicas y Perfil Clínico">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <FormField htmlFor="gender" label="Género">
                <Select
                  id="gender"
                  value={gender}
                  onChange={(event) => setGender(event.target.value)}
                >
                  {genders.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField htmlFor="age" label="Edad" error={errors.age}>
                <IconInput
                  id="age"
                  icon={CalendarClock}
                  type="number"
                  min={1}
                  max={120}
                  value={age}
                  onChange={(event) => setAge(event.target.value)}
                  placeholder="30 años"
                />
              </FormField>
              <FormField htmlFor="weight" label="Peso (kg)" error={errors.weight}>
                <IconInput
                  id="weight"
                  icon={Weight}
                  type="number"
                  min={1}
                  step="0.1"
                  value={weight}
                  onChange={(event) => setWeight(event.target.value)}
                  placeholder="76 kg"
                />
              </FormField>
              <FormField htmlFor="height" label="Estatura (m)" error={errors.height}>
                <IconInput
                  id="height"
                  icon={Ruler}
                  type="number"
                  min={0.1}
                  max={2.5}
                  step="0.01"
                  value={height}
                  onChange={(event) => setHeight(event.target.value)}
                  placeholder="1.78 m"
                />
              </FormField>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <FormField htmlFor="bloodType" label="Tipo de Sangre">
                <Select
                  id="bloodType"
                  value={bloodType}
                  onChange={(event) => setBloodType(event.target.value as BloodGroup)}
                >
                  {bloodTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField htmlFor="address" label="Dirección">
                <IconInput
                  id="address"
                  icon={MapPin}
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="Av. Ejemplo 123, Ciudad"
                />
              </FormField>
            </div>
          </SectionCard>

          <SectionCard icon={PhoneCall} title="Contacto de Emergencia">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField htmlFor="emergencyName" label="Nombre del Contacto">
                <IconInput
                  id="emergencyName"
                  icon={Users}
                  value={emergencyName}
                  onChange={(event) => setEmergencyName(event.target.value)}
                  placeholder="Ej. Nombre Apellido"
                />
              </FormField>
              <FormField htmlFor="emergencyRelationship" label="Parentesco / Relación">
                <Select
                  id="emergencyRelationship"
                  value={emergencyRelationship}
                  onChange={(event) =>
                    setEmergencyRelationship(event.target.value as Relationship)
                  }
                >
                  {relationships.map((relationship) => (
                    <option key={relationship.value} value={relationship.value}>
                      {relationship.label}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField htmlFor="emergencyPhone" label="Teléfono de Emergencia">
                <IconInput
                  id="emergencyPhone"
                  icon={Phone}
                  type="tel"
                  value={emergencyPhone}
                  onChange={(event) => setEmergencyPhone(event.target.value)}
                  placeholder="+52 55 0000 0000"
                />
              </FormField>
              <FormField htmlFor="emergencyEmail" label="Correo de Emergencia">
                <IconInput
                  id="emergencyEmail"
                  icon={Mail}
                  type="email"
                  value={emergencyEmail}
                  onChange={(event) => setEmergencyEmail(event.target.value)}
                  placeholder="nombre@ejemplo.com"
                />
              </FormField>
            </div>
          </SectionCard>

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(event) => setAcceptTerms(event.target.checked)}
              className="mt-0.5 size-4 shrink-0 rounded border-slate-300 accent-blue-600"
            />
            <span className="text-sm text-slate-600">
              Acepto los Términos y Condiciones de uso y el tratamiento de datos
              sensibles de salud según la normativa vigente.
            </span>
          </label>
          {errors.terms && <p className="mt-1 text-xs text-rose-600">{errors.terms}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Registrando…' : 'Finalizar Registro'}
            <ArrowRight className="size-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => navigate('/dashboard', { replace: true })}
            className="mx-auto block text-center text-sm font-medium text-slate-500 underline underline-offset-4 transition-colors hover:text-slate-700"
          >
            Omitir por ahora, completar luego
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-slate-400">
          Heart-Check no sustituye una valoración médica.
        </p>
      </div>

      <div className="relative hidden h-screen overflow-hidden lg:block">
        <img
          src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1000&q=80"
          alt="Equipo médico cuidando y monitoreando a un paciente"
          className="h-full w-full object-cover"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-900/30 to-slate-900/20"
          aria-hidden="true"
        />
        <span className="absolute left-8 top-8 inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-xs font-semibold text-slate-800 shadow-sm backdrop-blur">
          <Lock className="size-4 text-blue-600" aria-hidden="true" />
          Sistema Encriptado · SSL Secure 256-bit
        </span>
        <div className="absolute inset-x-0 bottom-0 px-8 pb-10">
          <div className="rounded-2xl border border-white/20 bg-white/10 p-6 backdrop-blur-md sm:p-8">
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-1.5 text-xs font-semibold tracking-wider text-white">
              <HeartPulse className="size-4" aria-hidden="true" />
              CUIDADO PROACTIVO
            </span>
            <h2 className="mt-5 text-2xl font-bold text-white">
              Detectamos antes de que sea urgente
            </h2>
            <p className="mt-2 max-w-lg text-white/85">
              Con tu perfil clínico completo, Heart-Check anticipa riesgos y te
              alerta a tiempo junto a tus contactos de emergencia.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
