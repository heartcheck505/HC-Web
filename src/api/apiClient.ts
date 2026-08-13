/**
 * Cliente HTTP centralizado para la API de Heart-Check.
 *
 * DevSecOps:
 * - El token JWT jamás se compromete en el código; se lee desde
 *   `sessionStorage` y se adjunta automáticamente al header
 *   `Authorization: Bearer <TOKEN>`.
 * - La URL base apunta directamente al backend de producción en HTTP:
 *   `http://heartcheckapi.runasp.net/api` por defecto, porque el servidor
 *   runasp.net NO sirve HTTPS (ERR_CONNECTION_RESET). Prioridad de resolución:
 *   `VITE_API_BASE_URL_HTTPS` (solo si algún día el backend expone HTTPS) →
 *   `VITE_API_BASE_URL` → default HTTP. La CSP (meta de `index.html` y la
 *   inyectada por `vite.config.ts` en build) NO contiene
 *   `upgrade-insecure-requests` ni restringe el esquema: `connect-src` admite
 *   `http://` y `https://` con comodines `*.runasp.net`, por lo que el
 *   navegador jamás reescribe `http://` a `https://` (eso causaba el
 *   ERR_CONNECTION_RESET). Nunca se usa una ruta relativa `/api` como base:
 *   todas las peticiones salen a la URL absoluta del backend (p. ej.
 *   `GET http://heartcheckapi.runasp.net/api/patients/me`). En local se puede
 *   conservar el proxy de `vite.config.ts` fijando `VITE_API_BASE_URL=/api`.
 * - Cortocircuito de datos de prueba: cuando `shouldUseMockData()` es
 *   verdadero (sin token o `VITE_USE_MOCK_DATA=true`), ninguna petición
 *   `GET` sale a la red: se lanza un `ApiError` simulado (status 0) que los
 *   callers capturan con `try/catch` / `Promise.allSettled` para usar los
 *   datos de reserva locales. Los `POST` (login, registro, eventos…) sí
 *   ejecutan `fetch()` para no romper el flujo de autenticación.
 * - Ante un 401 Unauthorized se limpia la sesión y se redirige a
 *   `/auth/login`.
 */
import type {
  AuthErrorResponse,
  StoredPatient,
  UserDto,
  UserPlan,
} from '../types/auth.types'
import type {
  Device,
  DeviceRegistrationRequest,
} from '../types/device.types'
import type {
  MeasurementReading,
  MeasurementSubmission,
  RiskAssessment,
  RiskLevel,
} from '../types/measurement.types'
import type { AppNotification } from '../types/notification.types'
import type {
  EmergencyContact,
  PatientMe,
  PatientMeCompatibility,
  PatientMeRequest,
} from '../types/patient.types'
import type { Plan, UserPlanSubscription } from '../types/plan.types'
import type { DailyStatistic } from '../types/statistics.types'

export const API_BASE_URL: string = (
  import.meta.env.VITE_API_BASE_URL_HTTPS ||
  import.meta.env.VITE_API_BASE_URL ||
  'http://heartcheckapi.runasp.net/api'
).replace(/\/+$/, '')

const TOKEN_STORAGE_KEY = 'heartcheck.token'
const USER_STORAGE_KEY = 'heartcheck.user'
const LEGACY_PII_STORAGE_KEYS = [
  'heartcheck.patientName',
  'heartcheck.phone',
  'local_symptoms_history',
]
/**
 * Prefijo de los respaldos de paciente en `localStorage` vinculados al email
 * del usuario (p. ej. `patient_data_{userEmail}`). Sobreviven al cierre de
 * sesión para que el perfil se restablezca al volver a autenticarse.
 */
const PATIENT_BACKUP_KEY_PREFIX = 'patient_data_'
const LOGIN_PATH = '/auth/login'

export interface ApiErrorPayload {
  status: number
  message: string
  errors?: Record<string, string[]>
}

export class ApiError extends Error {
  readonly status: number
  readonly errors?: Record<string, string[]>

  constructor(payload: ApiErrorPayload) {
    super(payload.message)
    this.name = 'ApiError'
    this.status = payload.status
    this.errors = payload.errors
  }
}

export function getStoredToken(): string | null {
  return window.sessionStorage.getItem(TOKEN_STORAGE_KEY)
}

export function setStoredToken(token: string): void {
  window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token)
}

export function removeStoredToken(): void {
  window.sessionStorage.removeItem(TOKEN_STORAGE_KEY)
}

export function getStoredUser(): UserDto | null {
  try {
    const raw = window.sessionStorage.getItem(USER_STORAGE_KEY)
    if (!raw) {
      return null
    }
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as UserDto).firstName === 'string' &&
      typeof (parsed as UserDto).lastName === 'string'
    ) {
      return parsed as UserDto
    }
    return null
  } catch {
    return null
  }
}

export function setStoredUser(user: UserDto): void {
  window.sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user))
}

export function getUserPlan(): UserPlan {
  const user = getStoredUser()
  return user?.plan === 'premium' ? 'premium' : 'basic'
}

export function setUserPlan(plan: UserPlan): void {
  const user = getStoredUser()
  if (!user) {
    return
  }
  setStoredUser({ ...user, plan })
}

/**
 * Ruta inicial por defecto según la licencia del usuario autenticado.
 */
export function getDefaultDashboardRoute(): string {
  return getUserPlan() === 'premium' ? '/dashboard-premium' : '/dashboard'
}

/**
 * Nombre completo del paciente/tutor persistido en la sesión. Devuelve una
 * cadena vacía si el usuario aún no registró esos datos.
 */
export function getStoredPatientName(): string {
  const user = getStoredUser()
  if (!user?.patient) {
    return ''
  }
  return `${user.patient.firstName} ${user.patient.lastName}`.trim()
}

/**
 * Etiqueta de estado vacío unificada para toda la app: se muestra cuando no
 * hay paciente registrado en la sesión.
 */
export const NO_PATIENT_LABEL = 'Sin paciente registrado'

/**
 * Fuente única de datos del paciente para la interfaz: nombre desde la sesión,
 * respaldo local vinculado al email del usuario o etiqueta de estado vacío.
 * Todas las vistas deben consumir esta función.
 */
export function getStoredPatientDisplayName(): string {
  return (
    getStoredPatientName() ||
    getBackedUpPatientName() ||
    NO_PATIENT_LABEL
  )
}

export function setStoredPatient(patient: StoredPatient): void {
  const user = getStoredUser()
  if (!user) {
    return
  }
  setStoredUser({ ...user, patient })
  // Respaldo por usuario en localStorage: sobrevive al cierre de sesión.
  backupPatientToLocal(user.email, patient)
}

function patientBackupKey(email: string): string {
  return `${PATIENT_BACKUP_KEY_PREFIX}${email.trim().toLowerCase()}`
}

function isValidStoredPatient(value: unknown): value is StoredPatient {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.firstName === 'string' &&
    typeof candidate.lastName === 'string'
  )
}

/**
 * Guarda una copia del paciente en `localStorage` asociada al email de la
 * cuenta, de modo que al volver a iniciar sesión se pueda restablecer aunque
 * la API no devuelva el perfil.
 */
export function backupPatientToLocal(
  email: string,
  patient: StoredPatient,
): void {
  if (!email || !isValidStoredPatient(patient)) {
    return
  }
  try {
    window.localStorage.setItem(
      patientBackupKey(email),
      JSON.stringify(patient),
    )
  } catch {
    // localStorage no disponible o lleno: el respaldo se omite sin romper el
    // flujo de guardado de la sesión.
  }
}

/**
 * Paciente respaldado en `localStorage` para la cuenta autenticada, o `null`
 * si no existe. La fuente primaria sigue siendo `sessionStorage`; este respaldo
 * es solo el fallback para cuando la API no devuelve el perfil.
 */
export function getBackedUpPatient(): StoredPatient | null {
  const email = getStoredUser()?.email
  if (!email) {
    return null
  }
  try {
    const raw = window.localStorage.getItem(patientBackupKey(email))
    if (!raw) {
      return null
    }
    const parsed: unknown = JSON.parse(raw)
    return isValidStoredPatient(parsed) ? parsed : null
  } catch {
    return null
  }
}

function getBackedUpPatientName(): string {
  const backup = getBackedUpPatient()
  if (!backup) {
    return ''
  }
  return `${backup.firstName} ${backup.lastName}`.trim()
}

/**
 * Contacto de emergencia del paciente autenticado, con prioridad:
 * 1. Campos de la sesión (`emergencyContactName`/`emergencyContactPhone`)
 *    del paciente registrado.
 * 2. Perfil del usuario/cuidador guardado durante el registro.
 * 3. Respaldo local (`localStorage`) asociado al email de la cuenta.
 *
 * Devuelve cadenas vacías cuando no hay datos registrados.
 */
export function getStoredEmergencyContact(): {
  name: string
  phone: string
} {
  const user = getStoredUser()
  const patient = user?.patient

  const name =
    asString(patient?.emergencyContactName) ??
    asString(user?.emergencyContactName) ??
    asString(getBackedUpPatient()?.emergencyContactName) ??
    ''
  const phone =
    asString(patient?.emergencyContactPhone) ??
    asString(user?.emergencyContactPhone) ??
    asString(getBackedUpPatient()?.emergencyContactPhone) ??
    ''
  return { name, phone }
}

/**
 * Normaliza un teléfono para su uso en enlaces `tel:`: conserva solo dígitos
 * y el signo `+` inicial. Devuelve `null` si no parece un teléfono válido.
 */
export function normalizePhoneForTel(phone: string): string | null {
  const compact = phone.trim().replace(/[\s().-]/g, '')
  return /^\+\d{7,15}$/.test(compact) ? compact : null
}

/**
 * Restablece el paciente de la sesión tras autenticarse:
 * 1. Intenta `GET /api/patients/me` con el token recién guardado.
 * 2. Si la API no devuelve el perfil (o el backend está inactivo), cae al
 *    respaldo local de `localStorage` asociado al email de la cuenta.
 *
 * Devuelve `true` si el paciente quedó disponible en la sesión.
 */
export async function restorePatientProfile(): Promise<boolean> {
  try {
    const profile = await getPatientMe()
    const firstName = profile?.firstName?.trim()
    const lastName = profile?.lastName?.trim()
    if (firstName && lastName) {
      setStoredPatient({
        firstName,
        lastName,
        emergencyContactName: profile.emergencyContactName ?? null,
        emergencyContactPhone: profile.emergencyContactPhone ?? null,
      })
      return true
    }
  } catch {
    // Backend inactivo, sin token válido o perfil inexistente: se usa el
    // respaldo local.
  }
  const backup = getBackedUpPatient()
  if (backup) {
    setStoredPatient(backup)
    return true
  }
  return false
}

export function removeStoredUser(): void {
  window.sessionStorage.removeItem(USER_STORAGE_KEY)
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/**
 * Devuelve el contacto de emergencia primario del arreglo `emergencyContacts`
 * (el marcado con `isPrimary: true` o, si ninguno lo está, el primero), o
 * `null` cuando el arreglo está vacío/ausente. No arroja si un elemento viene
 * parcial o `null` desde el backend.
 */
export function getPrimaryEmergencyContact(
  contacts: EmergencyContact[] | null | undefined,
): EmergencyContact | null {
  if (!Array.isArray(contacts) || contacts.length === 0) {
    return null
  }
  return (
    contacts.find((contact) => contact?.isPrimary === true) ??
    contacts[0] ??
    null
  )
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter(
    (item): item is string => typeof item === 'string' && item.trim() !== '',
  )
}

function toNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * Normaliza la respuesta de `GET/PUT /api/patients/me` al modelo tipado de la
 * UI, manteniendo compatibilidad con los lectores heredados de
 * `emergencyContactName`/`emergencyContactPhone`:
 *
 * - Cuando el backend devuelve los contactos como arreglo
 *   `emergencyContacts`, los getters raíz se rellenan con los datos del
 *   contacto primario (`isPrimary` o el primero). Si el backend sigue
 *   enviando los campos planos, se respetan sin sobrescribir.
 * - `medications` se normaliza a un arreglo plano de textos; nunca se intenta
 *   parsear dosis/frecuencia en la UI.
 * - Campos nulos/ausentes se degradan a `null`/`[]` sin romper la vista.
 */
export function normalizePatientMe(
  payload: PatientMe | null | undefined,
): PatientMe & PatientMeCompatibility {
  if (typeof payload !== 'object' || payload === null) {
    return {
      firstName: '',
      lastName: '',
      emergencyContactName: null,
      emergencyContactPhone: null,
      medications: [],
      emergencyContacts: [],
    }
  }
  const primary = getPrimaryEmergencyContact(payload.emergencyContacts)
  const compatibility: PatientMeCompatibility = {
    emergencyContactName:
      asString(payload.emergencyContactName) ?? primary?.name ?? null,
    emergencyContactPhone:
      asString(payload.emergencyContactPhone) ?? primary?.phone ?? null,
  }
  return {
    ...payload,
    ...compatibility,
    age: toNumberOrNull(payload.age),
    initialDiagnosis: asString(payload.initialDiagnosis),
    assignedDoctor: asString(payload.assignedDoctor),
    observations: asString(payload.observations),
    medications: toStringArray(payload.medications),
    emergencyContacts: Array.isArray(payload.emergencyContacts)
      ? payload.emergencyContacts
      : [],
  }
}

/**
 * Normaliza el `riskLevel` del modelo de ML a un vocabulario único. Acepta
 * variantes en español e inglés (`bajo`/`low`, `medio`/`medium`/`moderate`,
 * `alto`/`high`, `critico`/`critical`). Devuelve `null` ante valores
 * desconocidos o ausentes.
 */
export function normalizeRiskLevel(value: unknown): RiskLevel | null {
  if (typeof value !== 'string') {
    return null
  }
  const normalized = value.trim().toLowerCase()
  if (normalized === 'bajo' || normalized === 'low') {
    return 'bajo'
  }
  if (
    normalized === 'medio' ||
    normalized === 'medium' ||
    normalized === 'moderate' ||
    normalized === 'moderado'
  ) {
    return 'medio'
  }
  if (normalized === 'alto' || normalized === 'high') {
    return 'alto'
  }
  if (normalized === 'critico' || normalized === 'critical') {
    return 'critico'
  }
  return null
}

/**
 * Mapea el objeto `riskAssessment` crudo del backend al modelo tipado. Si el
 * objeto no es un objeto válido (o viene `null`), devuelve `null` para que la
 * UI degrade al estado "Evaluando tendencias..." sin romper.
 */
export function normalizeRiskAssessment(value: unknown): RiskAssessment | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  const raw = value as Record<string, unknown>
  const score = toNumberOrNull(raw.score)
  const riskLevel = normalizeRiskLevel(raw.riskLevel)
  const recommendation = asString(raw.recommendation)
  if (riskLevel === null && score === null && recommendation === null) {
    return null
  }
  return { riskLevel, score, recommendation }
}

/**
 * Normaliza el payload de autenticación del backend (o un login local) a un
 * `UserDto` persistible en `sessionStorage`.
 *
 * DevSecOps:
 * - Acepta formatos variados del backend (`user` anidado, `nombre` en vez de
 *   `firstName`/`lastName`) y deriva el nombre del correo como último recurso,
 *   evitando fallar con "Usuario invitado" cuando el backend no devuelve el
 *   perfil.
 * - Devuelve `null` únicamente si no hay forma de obtener identidad alguna
 *   (nunca fabrica nombres ficticios ni datos PII inventados).
 */
export function normalizeStoredUser(payload: unknown): UserDto | null {
  if (typeof payload !== 'object' || payload === null) {
    return null
  }
  const raw = payload as Record<string, unknown>
  const nested =
    typeof raw.user === 'object' && raw.user !== null
      ? (raw.user as Record<string, unknown>)
      : null

  const id = asString(nested?.id ?? raw.id)
  const email = asString(nested?.email ?? raw.email)
  const role = asString(nested?.role ?? raw.role)
  // Por defecto se restringe: solo se concede `premium` si el backend lo
  // declara explícitamente.
  const plan: UserPlan =
    (asString(nested?.plan ?? raw.plan) === 'premium' ? 'premium' : 'basic')

  const rawPatient = nested?.patient ?? raw.patient
  const patient: StoredPatient | undefined =
    typeof rawPatient === 'object' &&
    rawPatient !== null &&
    typeof (rawPatient as StoredPatient).firstName === 'string' &&
    typeof (rawPatient as StoredPatient).lastName === 'string'
      ? {
          firstName: (rawPatient as StoredPatient).firstName,
          lastName: (rawPatient as StoredPatient).lastName,
          secondLastName: (rawPatient as StoredPatient).secondLastName,
          emergencyContactName:
            (rawPatient as StoredPatient).emergencyContactName ?? null,
          emergencyContactPhone:
            (rawPatient as StoredPatient).emergencyContactPhone ?? null,
        }
      : undefined

  let firstName = asString(nested?.firstName ?? raw.firstName)
  let lastName = asString(nested?.lastName ?? raw.lastName)

  const nombre = asString(nested?.nombre ?? raw.nombre)
  if (nombre && firstName === null && lastName === null) {
    const parts = nombre.split(/\s+/).filter(Boolean)
    firstName = parts[0] ?? null
    lastName = parts.slice(1).join(' ') || null
  }

  if (firstName === null && email !== null) {
    const localPart = email.split('@')[0] ?? ''
    firstName = localPart
      .replace(/[._-]+/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  }

  if (firstName === null && lastName === null) {
    return null
  }

  return {
    id: id ?? email ?? 'local-user',
    firstName: firstName ?? '',
    lastName: lastName ?? '',
    email: email ?? '',
    role:
      role === 'Admin' || role === 'Medic' || role === 'Nurse'
        ? role
        : 'Nurse',
    plan,
    patient,
    emergencyContactName:
      asString(nested?.emergencyContactName ?? raw.emergencyContactName) ??
      patient?.emergencyContactName ??
      null,
    emergencyContactPhone:
      asString(nested?.emergencyContactPhone ?? raw.emergencyContactPhone) ??
      patient?.emergencyContactPhone ??
      null,
  }
}

export function clearSession(): void {
  removeStoredToken()
  removeStoredUser()
  // Los respaldos por usuario (`patient_data_{userEmail}`) se conservan
  // adrede en `localStorage` para restablecer el paciente al volver a
  // iniciar sesión con la misma cuenta.
  // Remove data written by earlier client versions during the migration.
  for (const key of LEGACY_PII_STORAGE_KEYS) {
    window.localStorage?.removeItem(key)
  }
}

export function isAuthenticated(): boolean {
  return Boolean(getStoredToken())
}

export function shouldUseMockData(): boolean {
  if (import.meta.env.VITE_USE_MOCK_DATA === 'true') {
    return true
  }
  if (import.meta.env.VITE_USE_MOCK_DATA === 'false') {
    return false
  }
  return !isAuthenticated()
}

function handleUnauthorized(): void {
  clearSession()
  if (typeof window === 'undefined') {
    return
  }
  if (!window.location.pathname.startsWith(LOGIN_PATH)) {
    const redirect = encodeURIComponent(
      window.location.pathname + window.location.search,
    )
    window.location.assign(`${LOGIN_PATH}?redirect=${redirect}`)
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
  skipAuthRedirect?: boolean
}

function parseError(status: number, payload: unknown): ApiError {
  const fallback = 'No se pudo completar la operación. Intente nuevamente.'
  if (payload && typeof payload === 'object') {
    const body = payload as AuthErrorResponse
    const title = (payload as { title?: unknown }).title
    const detail = (payload as { detail?: unknown }).detail
    const errors =
      body.errors && typeof body.errors === 'object' ? body.errors : undefined
    // Validación de ASP.NET: `errors` es un diccionario campo → mensajes.
    if (errors && Object.keys(errors).length > 0) {
      const firstKey = Object.keys(errors)[0]
      const firstDetail = errors[firstKey]?.[0]
      if (typeof firstDetail === 'string' && firstDetail.trim() !== '') {
        return new ApiError({ status, message: firstDetail, errors })
      }
    }
    const message =
      typeof body.message === 'string' && body.message.trim() !== ''
        ? body.message
        : typeof detail === 'string' && detail.trim() !== ''
          ? detail
          : typeof title === 'string' && title.trim() !== ''
            ? title
            : fallback
    return new ApiError({ status, message, errors })
  }
  // Cuerpos de texto plano o HTML (p. ej. páginas de error del servidor).
  if (typeof payload === 'string' && payload.trim() !== '') {
    const snippet = payload.trim().slice(0, 300)
    return new ApiError({ status, message: snippet })
  }
  return new ApiError({ status, message: fallback })
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  if (options.method === 'GET' && shouldUseMockData()) {
    throw new ApiError({
      status: 0,
      message:
        'Sin sesión activa: usando datos de prueba, no se ejecuta la petición a la API.',
    })
  }

  const token = getStoredToken()
  const headers = new Headers()
  headers.set('Accept', 'application/json')

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    })
  } catch {
    throw new ApiError({
      status: 0,
      message:
        'No se pudo conectar con el servidor. Verifique su conexión a internet e intente nuevamente.',
    })
  }

  if (response.status === 401) {
    if (!options.skipAuthRedirect) {
      handleUnauthorized()
    }
    throw new ApiError({
      status: 401,
      message: 'Su sesión ha expirado. Inicie sesión nuevamente.',
    })
  }

  const contentType = response.headers.get('content-type') ?? ''
  // `application/problem+json` es el content-type de Problem Details (ASP.NET).
  const isJson = contentType.includes('json')
  let payload: unknown = null
  if (response.status !== 204) {
    try {
      payload = isJson ? await response.json() : await response.text()
    } catch {
      // Content-Type JSON con cuerpo no parseable (p. ej. HTML de un proxy):
      // se intenta leer como texto para no perder el mensaje del servidor.
      if (isJson) {
        try {
          payload = await response.text()
        } catch {
          payload = null
        }
      }
    }
  }

  if (!response.ok) {
    throw parseError(response.status, payload)
  }

  return payload as T
}

export const apiClient = {
  get<T>(
    path: string,
    options?: { signal?: AbortSignal },
  ): Promise<T> {
    return request<T>(path, { method: 'GET', ...options })
  },
  post<T>(
    path: string,
    body?: unknown,
    options?: { signal?: AbortSignal; skipAuthRedirect?: boolean },
  ): Promise<T> {
    return request<T>(path, { method: 'POST', body, ...options })
  },
  put<T>(
    path: string,
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<T> {
    return request<T>(path, { method: 'PUT', body, signal })
  },
  patch<T>(
    path: string,
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<T> {
    return request<T>(path, { method: 'PATCH', body, signal })
  },
  delete<T>(path: string, signal?: AbortSignal): Promise<T> {
    return request<T>(path, { method: 'DELETE', signal })
  },
}

/**
 * Datos del paciente que alimentan `GET/PUT /api/patients/me`. La UI puede
 * manejar `secondLastName` por separado; al construir el payload los apellidos
 * se concatenan y solo `firstName`/`lastName` viajan al backend.
 */
export interface PatientMeUpdateInput {
  /**
   * Id del paciente tal como lo devolvió `GET /api/patients/me`. El backend
   * (ASP.NET Core) valida el campo `Id` como requerido en `PUT`: si la UI lo
   * tiene, viaja en el cuerpo; si no, el campo se omite por completo (nunca
   * se envía un `id` vacío o `null`).
   */
  id?: string | null
  firstName: string
  lastName: string
  secondLastName?: string | null
  phone?: PatientMeRequest['phone']
  dateOfBirth?: PatientMeRequest['dateOfBirth']
  gender?: PatientMeRequest['gender']
  bloodType?: PatientMeRequest['bloodType']
  emergencyContactName?: PatientMeRequest['emergencyContactName']
  emergencyContactPhone?: PatientMeRequest['emergencyContactPhone']
  address?: PatientMeRequest['address']
  initialDiagnosis?: PatientMeRequest['initialDiagnosis']
  assignedDoctor?: PatientMeRequest['assignedDoctor']
  observations?: PatientMeRequest['observations']
  medications?: PatientMeRequest['medications']
  emergencyContacts?: PatientMeRequest['emergencyContacts']
}

export function buildPatientMePayload(
  input: PatientMeUpdateInput,
): PatientMeRequest {
  const lastNameParts = [input.lastName, input.secondLastName].filter(
    (part): part is string => typeof part === 'string' && part.trim() !== '',
  )
  const payload: PatientMeRequest = {
    firstName: input.firstName.trim(),
    lastName: lastNameParts.join(' ').trim(),
    phone: input.phone ?? null,
    dateOfBirth: input.dateOfBirth ?? null,
    gender: input.gender ?? null,
    bloodType: input.bloodType ?? null,
    emergencyContactName: input.emergencyContactName ?? null,
    emergencyContactPhone: input.emergencyContactPhone ?? null,
    address: input.address ?? null,
    initialDiagnosis: input.initialDiagnosis ?? null,
    assignedDoctor: input.assignedDoctor ?? null,
    observations: input.observations ?? null,
    medications:
      input.medications === undefined ? null : toStringArray(input.medications),
    emergencyContacts:
      input.emergencyContacts == null
        ? null
        : input.emergencyContacts.map((contact) => ({
            name: asString(contact?.name) ?? '',
            relationship: asString(contact?.relationship) ?? '',
            phone: asString(contact?.phone) ?? '',
            email: asString(contact?.email),
            isPrimary: contact?.isPrimary === true,
          })),
  }
  // El backend (ASP.NET Core) valida la propiedad `Id` como requerida en
  // PUT /api/patients/me. Para cubrir la deserialización del modelo sin
  // importar la convención de naming, el ObjectId del paciente viaja en las
  // tres variantes: `Id` (PascalCase), `id` (camelCase) y `patientId`.
  // Si no está disponible, el campo se omite por completo: nunca un id vacío.
  if (typeof input.id === 'string' && input.id.trim() !== '') {
    const patientId = input.id.trim()
    payload.id = patientId
    payload.Id = patientId
    payload.patientId = patientId
  }
  return payload
}

/**
 * Funciones tipadas alineadas con la especificación de la API de producción.
 * Todas heredan el header `Authorization: Bearer <token>` de `request()`.
 */

export async function getPatientMe(): Promise<
  PatientMe & PatientMeCompatibility
> {
  const profile = await apiClient.get<PatientMe>(API_ENDPOINTS.patients.me)
  return normalizePatientMe(profile)
}

export async function updatePatientMe(
  input: PatientMeUpdateInput,
): Promise<PatientMe & PatientMeCompatibility> {
  const profile = await apiClient.put<PatientMe>(
    API_ENDPOINTS.patients.me,
    buildPatientMePayload(input),
  )
  return normalizePatientMe(profile)
}

export async function getPlans(): Promise<Plan[]> {
  return apiClient.get<Plan[]>(API_ENDPOINTS.plans.list)
}

export async function subscribeToPlan(planId: string): Promise<unknown> {
  return apiClient.post<unknown>(API_ENDPOINTS.plans.userPlans, { planId })
}

export async function getCurrentUserPlan(): Promise<UserPlanSubscription | null> {
  return apiClient.get<UserPlanSubscription | null>(
    API_ENDPOINTS.plans.current,
  )
}

export async function getDevices(): Promise<Device[]> {
  return apiClient.get<Device[]>(API_ENDPOINTS.devices.list)
}

export async function registerDevice(
  payload: DeviceRegistrationRequest,
): Promise<Device> {
  return apiClient.post<Device>(API_ENDPOINTS.devices.register, payload)
}

export async function createMeasurement(
  payload: MeasurementSubmission,
): Promise<MeasurementReading | null> {
  const measurement = await apiClient.post<MeasurementReading | null>(
    API_ENDPOINTS.measurements.create,
    payload,
  )
  if (typeof measurement !== 'object' || measurement === null) {
    return null
  }
  return normalizeMeasurementReading(measurement)
}

/**
 * Mapea una medición cruda del backend al modelo exacto de la UI, incluido
 * el objeto `riskAssessment` del modelo de Machine Learning (null-safe).
 */
export function normalizeMeasurementReading(
  reading: MeasurementReading,
): MeasurementReading {
  return {
    timestamp: typeof reading?.timestamp === 'string' ? reading.timestamp : '',
    deviceId: typeof reading?.deviceId === 'string' ? reading.deviceId : '',
    bpm: toNumberOrNull(reading?.bpm) ?? 0,
    quality: asString(reading?.quality),
    context: asString(reading?.context),
    isNormal: reading?.isNormal === true,
    notes: asString(reading?.notes),
    symptoms: toStringArray(reading?.symptoms),
    riskAssessment: normalizeRiskAssessment(reading?.riskAssessment),
  }
}

/**
 * Lecturas exactas de `GET /api/measurements` con el modelo
 * `{ timestamp, deviceId, bpm, quality, context, isNormal, notes, symptoms,
 * riskAssessment }`. Acepta `from`/`to` (ISO 8601) para acotar el período
 * consultado. Cada lectura se mapea al modelo exacto y se degradan los campos
 * nulos/ausentes (`symptoms` → `[]`, `quality`/`context`/`notes` → `null`,
 * `riskAssessment` → `null`) para que ninguna gráfica o lista rompa con
 * respuestas incompletas.
 */
export async function getMeasurements(
  from?: string,
  to?: string,
): Promise<MeasurementReading[]> {
  const query = new URLSearchParams()
  if (from) {
    query.set('from', from)
  }
  if (to) {
    query.set('to', to)
  }
  const qs = query.toString()
  const readings = await apiClient.get<MeasurementReading[]>(
    `${API_ENDPOINTS.measurements.list}${qs ? `?${qs}` : ''}`,
  )
  if (!Array.isArray(readings)) {
    return []
  }
  return readings.map(normalizeMeasurementReading)
}

export async function getNotifications(): Promise<AppNotification[]> {
  return apiClient.get<AppNotification[]>(API_ENDPOINTS.notifications.list)
}

/**
 * Resumen diario de `GET /api/statistics/daily`:
 * `{ date, averageBpm, minBpm, maxBpm, totalMeasurements, normalMeasurements,
 * abnormalMeasurements }`. Los días sin mediciones pueden llegar con valores
 * `null`; se degradan a `0` para que los cálculos de tendencia de la UI
 * (promedios, máximos) no propaguen `null`.
 */
export async function getDailyStatistics(
  from: string,
  to: string,
): Promise<DailyStatistic[]> {
  const query = new URLSearchParams({ from, to }).toString()
  const statistics = await apiClient.get<DailyStatistic[]>(
    `${API_ENDPOINTS.statistics.daily}?${query}`,
  )
  if (!Array.isArray(statistics)) {
    return []
  }
  return statistics.map((stat) => ({
    date: typeof stat?.date === 'string' ? stat.date : '',
    averageBpm: toNumberOrNull(stat?.averageBpm) ?? 0,
    minBpm: toNumberOrNull(stat?.minBpm) ?? 0,
    maxBpm: toNumberOrNull(stat?.maxBpm) ?? 0,
    totalMeasurements: toNumberOrNull(stat?.totalMeasurements) ?? 0,
    normalMeasurements: toNumberOrNull(stat?.normalMeasurements) ?? 0,
    abnormalMeasurements: toNumberOrNull(stat?.abnormalMeasurements) ?? 0,
  }))
}

export const tokenStorage = {
  get: getStoredToken,
  set: setStoredToken,
  clear: removeStoredToken,
}

export const API_ENDPOINTS = {
  auth: {
    login: '/auth/login',
    register: '/auth/register',
  },
  patients: {
    list: '/patients',
    detail: (id: string) => `/patients/${id}`,
    me: '/patients/me',
    create: '/patients',
    update: (id: string) => `/patients/${id}`,
    remove: (id: string) => `/patients/${id}`,
  },
  plans: {
    list: '/plans',
    userPlans: '/user-plans',
    current: '/user-plans/me',
  },
  devices: {
    list: '/devices',
    detail: (id: string) => `/devices/${id}`,
    register: '/devices',
    update: (id: string) => `/devices/${id}`,
    remove: (id: string) => `/devices/${id}`,
  },
  measurements: {
    list: '/measurements',
    create: '/measurements',
    history: '/measurements/history',
    detail: (id: string) => `/measurements/${id}`,
    summary: '/measurements/summary',
  },
  events: {
    list: '/events',
    create: '/events',
  },
  alerts: {
    list: '/alerts',
    detail: (id: string) => `/alerts/${id}`,
    ack: (id: string) => `/alerts/${id}/ack`,
    resolve: (id: string) => `/alerts/${id}/resolve`,
  },
  notifications: {
    list: '/notifications',
  },
  statistics: {
    daily: '/statistics/daily',
  },
} as const
