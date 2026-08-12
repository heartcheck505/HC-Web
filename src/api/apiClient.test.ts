import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  API_ENDPOINTS,
  NO_PATIENT_LABEL,
  backupPatientToLocal,
  buildPatientMePayload,
  clearSession,
  getBackedUpPatient,
  getDefaultDashboardRoute,
  getStoredEmergencyContact,
  getStoredPatientDisplayName,
  getStoredPatientName,
  getStoredToken,
  getStoredUser,
  getUserPlan,
  isAuthenticated,
  normalizePhoneForTel,
  normalizeStoredUser,
  restorePatientProfile,
  setStoredPatient,
  setStoredToken,
  setStoredUser,
  setUserPlan,
  shouldUseMockData,
} from './apiClient'

const sessionStorage = new Map<string, string>()
const localStorage = new Map<string, string>()

const fakeWindow = {
  sessionStorage: {
    getItem: (key: string): string | null => sessionStorage.get(key) ?? null,
    setItem: (key: string, value: string): void => {
      sessionStorage.set(key, value)
    },
    removeItem: (key: string): void => {
      sessionStorage.delete(key)
    },
  },
  localStorage: {
    getItem: (key: string): string | null => localStorage.get(key) ?? null,
    setItem: (key: string, value: string): void => {
      localStorage.set(key, value)
    },
    removeItem: (key: string): void => {
      localStorage.delete(key)
    },
  },
  location: {
    pathname: '/dashboard',
    search: '',
    assign: (): undefined => undefined,
  },
}

const okJsonResponse = (body: unknown): unknown => ({
  status: 200,
  ok: true,
  headers: { get: (): string => 'application/json' },
  json: async (): Promise<unknown> => body,
})

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  vi.stubEnv('VITE_USE_MOCK_DATA', undefined)
  ;(globalThis as unknown as { window: typeof fakeWindow }).window = fakeWindow
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('tokenStorage', () => {
  it('almacena y recupera el token', () => {
    setStoredToken('jwt-test')
    expect(getStoredToken()).toBe('jwt-test')
    expect(isAuthenticated()).toBe(true)
  })

  it('limpia la sesión completa', () => {
    setStoredToken('jwt-test')
    setStoredUser({
      id: 'u1',
      firstName: 'Ana',
      lastName: 'Pérez',
      email: 'ana@example.com',
      role: 'Nurse',
    })
    clearSession()
    expect(getStoredToken()).toBeNull()
    expect(getStoredUser()).toBeNull()
    expect(isAuthenticated()).toBe(false)
  })
})

describe('user storage', () => {
  it('persiste y recupera el usuario', () => {
    setStoredUser({
      id: 'u1',
      firstName: 'Ana',
      lastName: 'Pérez',
      email: 'ana@example.com',
      role: 'Nurse',
    })
    expect(getStoredUser()).toMatchObject({
      firstName: 'Ana',
      email: 'ana@example.com',
    })
  })

  it('descarta datos de usuario corruptos', () => {
    sessionStorage.set('heartcheck.user', '{no-json')
    expect(getStoredUser()).toBeNull()
  })
})

describe('shouldUseMockData', () => {
  it('usa datos de prueba sin sesión activa', () => {
    expect(shouldUseMockData()).toBe(true)
  })

  it('no usa datos de prueba con sesión activa', () => {
    setStoredToken('jwt-test')
    expect(shouldUseMockData()).toBe(false)
  })
})

describe('normalizeStoredUser', () => {
  it('normaliza el objeto user anidado del backend', () => {
    const user = normalizeStoredUser({
      token: 'jwt-test',
      user: {
        id: 'u1',
        firstName: 'Ana',
        lastName: 'Pérez',
        email: 'ana@example.com',
        role: 'Nurse',
      },
    })
    expect(user).toMatchObject({
      id: 'u1',
      firstName: 'Ana',
      lastName: 'Pérez',
      email: 'ana@example.com',
      role: 'Nurse',
    })
  })

  it('usa el campo nombre cuando el backend no envía firstName', () => {
    const user = normalizeStoredUser({
      token: 'jwt-test',
      user: { id: 'u2', nombre: 'Carlos Ruiz', email: 'carlos@example.com' },
    })
    expect(user).toMatchObject({
      firstName: 'Carlos',
      lastName: 'Ruiz',
      email: 'carlos@example.com',
    })
  })

  it('acepta nombre a nivel raíz del payload', () => {
    const user = normalizeStoredUser({
      token: 'jwt-test',
      nombre: 'María López',
      email: 'maria@example.com',
    })
    expect(user).toMatchObject({
      firstName: 'María',
      lastName: 'López',
    })
  })

  it('deriva el nombre del correo como último recurso', () => {
    const user = normalizeStoredUser({
      token: 'jwt-test',
      email: 'ana.maria@example.com',
    })
    expect(user).toMatchObject({
      firstName: 'Ana Maria',
      email: 'ana.maria@example.com',
    })
  })

  it('descarta payloads sin identidad alguna', () => {
    expect(normalizeStoredUser(null)).toBeNull()
    expect(normalizeStoredUser('texto')).toBeNull()
    expect(normalizeStoredUser({ token: 'jwt-test' })).toBeNull()
  })

  it('conserva el contacto de emergencia del payload', () => {
    const user = normalizeStoredUser({
      token: 'jwt-test',
      user: {
        id: 'u5',
        nombre: 'Ana Pérez',
        email: 'ana@example.com',
        emergencyContactName: 'María García',
        emergencyContactPhone: '+52 55 2222 2222',
      },
    })
    expect(user).toMatchObject({
      emergencyContactName: 'María García',
      emergencyContactPhone: '+52 55 2222 2222',
    })
  })

  it('concede premium solo si el backend lo declara', () => {
    const premium = normalizeStoredUser({
      user: { id: 'u3', nombre: 'Ana', email: 'a@example.com', plan: 'premium' },
    })
    expect(premium?.plan).toBe('premium')
    const basic = normalizeStoredUser({
      user: { id: 'u4', nombre: 'Luis', email: 'l@example.com' },
    })
    expect(basic?.plan).toBe('basic')
    const rawPlan = normalizeStoredUser({
      token: 'jwt-test',
      nombre: 'Ana',
      email: 'a@example.com',
      plan: 'gold',
    })
    expect(rawPlan?.plan).toBe('basic')
  })
})

describe('plan de usuario', () => {
  it('devuelve básico por defecto', () => {
    expect(getUserPlan()).toBe('basic')
  })

  it('persiste el cambio de plan en la sesión', () => {
    setStoredUser({
      id: 'u1',
      firstName: 'Ana',
      lastName: 'Pérez',
      email: 'ana@example.com',
      role: 'Nurse',
    })
    expect(getUserPlan()).toBe('basic')
    setUserPlan('premium')
    expect(getUserPlan()).toBe('premium')
    expect(getStoredUser()?.plan).toBe('premium')
    setUserPlan('basic')
    expect(getUserPlan()).toBe('basic')
  })

  it('no crea usuario si no hay sesión activa', () => {
    setUserPlan('premium')
    expect(getUserPlan()).toBe('basic')
    expect(getStoredUser()).toBeNull()
  })
})

describe('datos de paciente en sesión', () => {
  it('persiste y recupera el nombre del paciente', () => {
    setStoredUser({
      id: 'u1',
      firstName: 'Ana',
      lastName: 'Pérez',
      email: 'ana@example.com',
      role: 'Nurse',
    })
    expect(getStoredPatientName()).toBe('')
    setStoredPatient({
      firstName: 'Juan',
      lastName: 'García',
      secondLastName: 'López',
    })
    expect(getStoredPatientName()).toBe('Juan García')
    expect(getStoredUser()?.patient).toEqual({
      firstName: 'Juan',
      lastName: 'García',
      secondLastName: 'López',
    })
  })

  it('normaliza el paciente incluido en el payload', () => {
    const user = normalizeStoredUser({
      token: 'jwt-test',
      user: {
        id: 'u1',
        nombre: 'Ana Pérez',
        email: 'ana@example.com',
        patient: { firstName: 'Juan', lastName: 'García' },
      },
    })
    expect(user?.patient).toMatchObject({
      firstName: 'Juan',
      lastName: 'García',
      emergencyContactName: null,
      emergencyContactPhone: null,
    })
  })

  it('muestra la etiqueta de vacío si no hay paciente registrado', () => {
    setStoredUser({
      id: 'u1',
      firstName: 'Ana',
      lastName: 'Pérez',
      email: 'ana@example.com',
      role: 'Nurse',
    })
    expect(getStoredPatientDisplayName()).toBe(NO_PATIENT_LABEL)
    expect(getStoredPatientDisplayName()).toBe('Sin paciente registrado')
  })

  it('usa el nombre de la sesión como única fuente de datos', () => {
    setStoredUser({
      id: 'u1',
      firstName: 'Ana',
      lastName: 'Pérez',
      email: 'ana@example.com',
      role: 'Nurse',
    })
    setStoredPatient({ firstName: 'Juan', lastName: 'García' })
    expect(getStoredPatientDisplayName()).toBe('Juan García')
  })
})

describe('ruta inicial según licencia', () => {
  it('usa /dashboard para licencia básica', () => {
    setStoredUser({
      id: 'u1',
      firstName: 'Ana',
      lastName: 'Pérez',
      email: 'ana@example.com',
      role: 'Nurse',
    })
    expect(getDefaultDashboardRoute()).toBe('/dashboard')
  })

  it('usa /dashboard-premium para licencia premium', () => {
    setStoredUser({
      id: 'u1',
      firstName: 'Ana',
      lastName: 'Pérez',
      email: 'ana@example.com',
      role: 'Nurse',
      plan: 'premium',
    })
    expect(getDefaultDashboardRoute()).toBe('/dashboard-premium')
  })
})

describe('buildPatientMePayload', () => {
  it('envía solo los campos exactos de GET/PUT /api/patients/me', () => {
    const payload = buildPatientMePayload({
      firstName: 'Juan',
      lastName: 'García',
      phone: '555-1234',
      dateOfBirth: '1980-05-01',
      gender: 'Male',
      bloodType: 'O+',
      emergencyContactName: 'María García',
      emergencyContactPhone: '555-5678',
      address: 'Calle 1 #23',
    })
    expect(payload).toEqual({
      firstName: 'Juan',
      lastName: 'García',
      phone: '555-1234',
      dateOfBirth: '1980-05-01',
      gender: 'Male',
      bloodType: 'O+',
      emergencyContactName: 'María García',
      emergencyContactPhone: '555-5678',
      address: 'Calle 1 #23',
    })
    expect(Object.keys(payload).sort()).toEqual(
      [
        'address',
        'bloodType',
        'dateOfBirth',
        'emergencyContactName',
        'emergencyContactPhone',
        'firstName',
        'gender',
        'lastName',
        'phone',
      ].sort(),
    )
  })

  it('concatena secondLastName en lastName sin enviarlo al backend', () => {
    const payload = buildPatientMePayload({
      firstName: 'Juan',
      lastName: 'García',
      secondLastName: 'López',
    })
    expect(payload.lastName).toBe('García López')
    expect('secondLastName' in payload).toBe(false)
  })

  it('normaliza los campos opcionales a null', () => {
    const payload = buildPatientMePayload({
      firstName: 'Ana',
      lastName: 'Pérez',
    })
    expect(payload).toMatchObject({
      firstName: 'Ana',
      lastName: 'Pérez',
      phone: null,
      dateOfBirth: null,
      gender: null,
      bloodType: null,
      emergencyContactName: null,
      emergencyContactPhone: null,
      address: null,
    })
  })
})

describe('endpoints de producción', () => {
  it('mapa los endpoints de planes según la especificación', () => {
    expect(API_ENDPOINTS.plans.list).toBe('/plans')
    expect(API_ENDPOINTS.plans.userPlans).toBe('/user-plans')
    expect(API_ENDPOINTS.plans.current).toBe('/user-plans/me')
  })

  it('mapa los endpoints de mediciones, dispositivos, notificaciones y estadísticas', () => {
    expect(API_ENDPOINTS.measurements.create).toBe('/measurements')
    expect(API_ENDPOINTS.measurements.history).toBe('/measurements/history')
    expect(API_ENDPOINTS.devices.register).toBe('/devices')
    expect(API_ENDPOINTS.notifications.list).toBe('/notifications')
    expect(API_ENDPOINTS.statistics.daily).toBe('/statistics/daily')
  })
})

describe('respaldo de paciente por usuario', () => {
  it('respaldar en localStorage al guardar el paciente en la sesión', () => {
    setStoredUser({
      id: 'u1',
      firstName: 'Ana',
      lastName: 'Pérez',
      email: 'ana@example.com',
      role: 'Nurse',
    })
    setStoredPatient({ firstName: 'Juan', lastName: 'García' })
    expect(getBackedUpPatient()).toEqual({ firstName: 'Juan', lastName: 'García' })
    expect(localStorage.get('patient_data_ana@example.com')).not.toBeNull()
    expect(localStorage.get('patient_data_ANA@EXAMPLE.COM')).toBeUndefined()
  })

  it('usa el respaldo local si la sesión no tiene paciente', () => {
    setStoredUser({
      id: 'u2',
      firstName: 'Luis',
      lastName: 'Ruiz',
      email: 'luis@example.com',
      role: 'Nurse',
    })
    expect(getStoredPatientDisplayName()).toBe(NO_PATIENT_LABEL)
    backupPatientToLocal('luis@example.com', {
      firstName: 'María',
      lastName: 'López',
    })
    expect(getStoredPatientName()).toBe('')
    expect(getStoredPatientDisplayName()).toBe('María López')
  })

  it('descarta respaldos corruptos', () => {
    setStoredUser({
      id: 'u3',
      firstName: 'Ana',
      lastName: 'Pérez',
      email: 'ana@example.com',
      role: 'Nurse',
    })
    localStorage.set('patient_data_ana@example.com', '{no-json')
    expect(getBackedUpPatient()).toBeNull()
    expect(getStoredPatientDisplayName()).toBe(NO_PATIENT_LABEL)
  })

  it('no accede al respaldo sin usuario en sesión', () => {
    const spy = vi.spyOn(localStorage, 'get')
    expect(getBackedUpPatient()).toBeNull()
    expect(spy).not.toHaveBeenCalled()
    expect(getStoredPatientDisplayName()).toBe(NO_PATIENT_LABEL)
  })
})

describe('cierre de sesión', () => {
  it('limpia la sesión pero conserva el respaldo por usuario', () => {
    setStoredUser({
      id: 'u1',
      firstName: 'Ana',
      lastName: 'Pérez',
      email: 'ana@example.com',
      role: 'Nurse',
    })
    setStoredPatient({ firstName: 'Juan', lastName: 'García' })
    expect(localStorage.get('patient_data_ana@example.com')).not.toBeNull()
    clearSession()
    expect(getStoredToken()).toBeNull()
    expect(getStoredUser()).toBeNull()
    expect(localStorage.get('patient_data_ana@example.com')).not.toBeNull()
    // Al volver a iniciar sesión con la misma cuenta se restablece el paciente.
    setStoredUser({
      id: 'u1',
      firstName: 'Ana',
      lastName: 'Pérez',
      email: 'ana@example.com',
      role: 'Nurse',
    })
    expect(getStoredPatientDisplayName()).toBe('Juan García')
  })
})

describe('restorePatientProfile', () => {
  it('almacena el paciente devuelto por GET /api/patients/me', async () => {
    setStoredToken('jwt-test')
    setStoredUser({
      id: 'u1',
      firstName: 'Ana',
      lastName: 'Pérez',
      email: 'ana@example.com',
      role: 'Nurse',
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        okJsonResponse({ firstName: 'Juan', lastName: 'García' }),
      ),
    )
    const restored = await restorePatientProfile()
    expect(restored).toBe(true)
    expect(getStoredPatientDisplayName()).toBe('Juan García')
    expect(getBackedUpPatient()).toMatchObject({
      firstName: 'Juan',
      lastName: 'García',
      emergencyContactName: null,
      emergencyContactPhone: null,
    })
  })

  it('cae al respaldo local si la API falla', async () => {
    setStoredToken('jwt-test')
    setStoredUser({
      id: 'u1',
      firstName: 'Ana',
      lastName: 'Pérez',
      email: 'ana@example.com',
      role: 'Nurse',
    })
    backupPatientToLocal('ana@example.com', {
      firstName: 'María',
      lastName: 'López',
    })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network')))
    const restored = await restorePatientProfile()
    expect(restored).toBe(true)
    expect(getStoredPatientDisplayName()).toBe('María López')
  })

  it('no falla sin respaldo ni perfil en la API', async () => {
    setStoredToken('jwt-test')
    setStoredUser({
      id: 'u1',
      firstName: 'Ana',
      lastName: 'Pérez',
      email: 'ana@example.com',
      role: 'Nurse',
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        okJsonResponse({ firstName: '', lastName: '' }),
      ),
    )
    const restored = await restorePatientProfile()
    expect(restored).toBe(false)
    expect(getStoredPatientDisplayName()).toBe(NO_PATIENT_LABEL)
  })
})

describe('getStoredEmergencyContact', () => {
  const baseUser = {
    id: 'u1',
    firstName: 'Ana',
    lastName: 'Pérez',
    email: 'ana@example.com',
    role: 'Nurse' as const,
  }

  it('devuelve vacío cuando no hay contacto registrado', () => {
    setStoredUser(baseUser)
    expect(getStoredEmergencyContact()).toEqual({ name: '', phone: '' })
  })

  it('prioriza el contacto del paciente sobre el del cuidador', () => {
    setStoredUser({
      ...baseUser,
      emergencyContactName: 'Cuidadora Ana',
      emergencyContactPhone: '+52 55 1111 1111',
      patient: {
        firstName: 'Juan',
        lastName: 'García',
        emergencyContactName: 'María García',
        emergencyContactPhone: '+52 55 2222 2222',
      },
    })
    expect(getStoredEmergencyContact()).toEqual({
      name: 'María García',
      phone: '+52 55 2222 2222',
    })
  })

  it('toma el contacto del perfil del cuidador si el paciente no lo tiene', () => {
    setStoredUser({
      ...baseUser,
      emergencyContactName: 'Cuidadora Ana',
      emergencyContactPhone: '+52 55 1111 1111',
      patient: { firstName: 'Juan', lastName: 'García' },
    })
    expect(getStoredEmergencyContact()).toEqual({
      name: 'Cuidadora Ana',
      phone: '+52 55 1111 1111',
    })
  })

  it('cae al respaldo local cuando la sesión no tiene contacto', () => {
    setStoredUser(baseUser)
    backupPatientToLocal('ana@example.com', {
      firstName: 'Juan',
      lastName: 'García',
      emergencyContactName: 'Respaldo',
      emergencyContactPhone: '+52 55 3333 3333',
    })
    expect(getStoredEmergencyContact()).toEqual({
      name: 'Respaldo',
      phone: '+52 55 3333 3333',
    })
  })

  it('se respalda en localStorage al guardar el paciente con contacto', () => {
    setStoredUser(baseUser)
    setStoredPatient({
      firstName: 'Juan',
      lastName: 'García',
      emergencyContactName: 'María García',
      emergencyContactPhone: '+52 55 2222 2222',
    })
    expect(JSON.parse(localStorage.get('patient_data_ana@example.com')!)).toEqual(
      expect.objectContaining({
        emergencyContactName: 'María García',
        emergencyContactPhone: '+52 55 2222 2222',
      }),
    )
  })

  it('conserva el contacto tras cerrar sesión y volver a autenticarse', () => {
    setStoredUser(baseUser)
    setStoredPatient({
      firstName: 'Juan',
      lastName: 'García',
      emergencyContactName: 'María García',
      emergencyContactPhone: '+52 55 2222 2222',
    })
    clearSession()
    setStoredUser(baseUser)
    expect(getStoredEmergencyContact()).toEqual({
      name: 'María García',
      phone: '+52 55 2222 2222',
    })
  })
})

describe('normalizePhoneForTel', () => {
  it('normaliza teléfonos con separadores', () => {
    expect(normalizePhoneForTel('+52 55 0000 0000')).toBe('+525500000000')
    expect(normalizePhoneForTel('+52 (55) 0000-0000')).toBe('+525500000000')
  })

  it('rechaza teléfonos sin código de país', () => {
    expect(normalizePhoneForTel('55 0000 0000')).toBeNull()
    expect(normalizePhoneForTel('')).toBeNull()
    expect(normalizePhoneForTel('abc')).toBeNull()
  })
})
