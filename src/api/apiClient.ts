/**
 * Cliente HTTP centralizado para la API de Heart-Check.
 *
 * DevSecOps:
 * - El token JWT jamás se compromete en el código; se lee desde
 *   `sessionStorage` y se adjunta automáticamente al header
 *   `Authorization: Bearer <TOKEN>`.
 * - La URL base es siempre relativa: `import.meta.env.VITE_API_BASE_URL` si
 *   está definida, o `/api` por defecto. En desarrollo el proxy de
 *   `vite.config.ts` redirige `/api` al backend sin disparar CORS; en
 *   producción (Render/HTTPS) las peticiones al mismo origen evitan errores
 *   de Mixed Content al no mezclar `https://` con `http://`.
 *   `VITE_API_BASE_URL` solo debe apuntar a una URL absoluta cuando el
 *   servidor de la API sea HTTPS.
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
} from '../types/measurement.types'
import type { AppNotification } from '../types/notification.types'
import type {
  PatientMe,
  PatientMeRequest,
} from '../types/patient.types'
import type { Plan, UserPlanSubscription } from '../types/plan.types'
import type { DailyStatistic } from '../types/statistics.types'

export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL || '/api'

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
    const message =
      typeof body.message === 'string'
        ? body.message
        : typeof title === 'string'
          ? title
          : fallback
    const errors =
      body.errors && typeof body.errors === 'object' ? body.errors : undefined
    return new ApiError({ status, message, errors })
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
  const isJson = contentType.includes('application/json')
  const payload = isJson && response.status !== 204 ? await response.json() : null

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
}

export function buildPatientMePayload(
  input: PatientMeUpdateInput,
): PatientMeRequest {
  const lastNameParts = [input.lastName, input.secondLastName].filter(
    (part): part is string => typeof part === 'string' && part.trim() !== '',
  )
  return {
    firstName: input.firstName.trim(),
    lastName: lastNameParts.join(' ').trim(),
    phone: input.phone ?? null,
    dateOfBirth: input.dateOfBirth ?? null,
    gender: input.gender ?? null,
    bloodType: input.bloodType ?? null,
    emergencyContactName: input.emergencyContactName ?? null,
    emergencyContactPhone: input.emergencyContactPhone ?? null,
    address: input.address ?? null,
  }
}

/**
 * Funciones tipadas alineadas con la especificación de la API de producción.
 * Todas heredan el header `Authorization: Bearer <token>` de `request()`.
 */

export async function getPatientMe(): Promise<PatientMe> {
  return apiClient.get<PatientMe>(API_ENDPOINTS.patients.me)
}

export async function updatePatientMe(
  input: PatientMeUpdateInput,
): Promise<PatientMe> {
  return apiClient.put<PatientMe>(
    API_ENDPOINTS.patients.me,
    buildPatientMePayload(input),
  )
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
): Promise<unknown> {
  return apiClient.post<unknown>(API_ENDPOINTS.measurements.create, payload)
}

/**
 * Lecturas exactas de `GET /api/measurements` con el modelo
 * `{ timestamp, patientId, deviceId, bpm, quality, context, isNormal, notes }`.
 * Acepta `from`/`to` (ISO 8601) para acotar el período consultado.
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
  return apiClient.get<MeasurementReading[]>(
    `${API_ENDPOINTS.measurements.list}${qs ? `?${qs}` : ''}`,
  )
}

export async function getNotifications(): Promise<AppNotification[]> {
  return apiClient.get<AppNotification[]>(API_ENDPOINTS.notifications.list)
}

export async function getDailyStatistics(
  from: string,
  to: string,
): Promise<DailyStatistic[]> {
  const query = new URLSearchParams({ from, to }).toString()
  return apiClient.get<DailyStatistic[]>(
    `${API_ENDPOINTS.statistics.daily}?${query}`,
  )
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
