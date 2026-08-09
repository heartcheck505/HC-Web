/**
 * Cliente HTTP centralizado para la API de Heart-Check.
 *
 * DevSecOps:
 * - El token JWT jamás se compromete en el código; se lee desde
 *   `localStorage` y se adjunta automáticamente al header
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
import type { AuthErrorResponse } from '../types/auth.types'

export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL || '/api'

const TOKEN_STORAGE_KEY = 'heartcheck.token'
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
  return window.localStorage.getItem(TOKEN_STORAGE_KEY)
}

export function setStoredToken(token: string): void {
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token)
}

export function removeStoredToken(): void {
  window.localStorage.removeItem(TOKEN_STORAGE_KEY)
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
  removeStoredToken()
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
  devices: {
    list: '/devices',
    detail: (id: string) => `/devices/${id}`,
    register: '/devices',
    update: (id: string) => `/devices/${id}`,
    remove: (id: string) => `/devices/${id}`,
  },
  measurements: {
    list: '/measurements',
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
} as const