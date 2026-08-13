import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  API_BASE_URL,
  API_ENDPOINTS,
  NO_PATIENT_LABEL,
  apiClient,
  backupPatientToLocal,
  buildPatientMePayload,
  clearSession,
  getBackedUpPatient,
  getDailyStatistics,
  getDefaultDashboardRoute,
  getMeasurements,
  getPrimaryEmergencyContact,
  getStoredEmergencyContact,
  getStoredPatientDisplayName,
  getStoredPatientName,
  getStoredToken,
  getStoredUser,
  getUserPlan,
  isAuthenticated,
  normalizePatientMe,
  normalizePhoneForTel,
  normalizeRiskAssessment,
  normalizeRiskLevel,
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
      initialDiagnosis: null,
      assignedDoctor: null,
      observations: null,
      medications: null,
      emergencyContacts: null,
    })
    expect(Object.keys(payload).sort()).toEqual(
      [
        'address',
        'assignedDoctor',
        'bloodType',
        'dateOfBirth',
        'emergencyContactName',
        'emergencyContactPhone',
        'emergencyContacts',
        'firstName',
        'gender',
        'initialDiagnosis',
        'lastName',
        'medications',
        'observations',
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

  it('incluye la información clínica y los contactos en el payload', () => {
    const payload = buildPatientMePayload({
      firstName: 'Juan',
      lastName: 'García',
      initialDiagnosis: 'Hipertensión arterial',
      assignedDoctor: 'Dra. Pérez',
      observations: 'Requiere control mensual.',
      medications: ['Atorvastatina 10 mg', 'Metoprolol 50 mg'],
      emergencyContacts: [
        {
          name: 'María García',
          relationship: 'hijo/a',
          phone: '+52 55 1111 1111',
          email: 'maria@example.com',
          isPrimary: true,
        },
      ],
    })
    expect(payload).toMatchObject({
      initialDiagnosis: 'Hipertensión arterial',
      assignedDoctor: 'Dra. Pérez',
      observations: 'Requiere control mensual.',
      medications: ['Atorvastatina 10 mg', 'Metoprolol 50 mg'],
      emergencyContacts: [
        {
          name: 'María García',
          relationship: 'hijo/a',
          phone: '+52 55 1111 1111',
          email: 'maria@example.com',
          isPrimary: true,
        },
      ],
    })
  })

  it('normaliza medications a arreglo plano y contactos vacíos a null', () => {
    const payload = buildPatientMePayload({
      firstName: 'Ana',
      lastName: 'Pérez',
      medications: ['  ', 'Aspirina 100 mg'],
      emergencyContacts: [
        { name: '', relationship: '', phone: '', isPrimary: false },
      ],
    })
    expect(payload.medications).toEqual(['Aspirina 100 mg'])
    expect(payload.emergencyContacts).toEqual([
      { name: '', relationship: '', phone: '', email: null, isPrimary: false },
    ])
  })

  it('envía el id en Id (PascalCase), id (camelCase) y patientId, y lo omite si no existe', () => {
    const objectId = '664f0c2a9d3b4c0012ab34cd'
    const withId = buildPatientMePayload({
      id: objectId,
      firstName: 'Juan',
      lastName: 'García',
    })
    expect(withId.id).toBe(objectId)
    expect(withId.Id).toBe(objectId)
    expect(withId.patientId).toBe(objectId)

    const withoutId = buildPatientMePayload({
      firstName: 'Juan',
      lastName: 'García',
    })
    expect('id' in withoutId).toBe(false)
    expect('Id' in withoutId).toBe(false)
    expect('patientId' in withoutId).toBe(false)

    const nullId = buildPatientMePayload({
      id: null,
      firstName: 'Juan',
      lastName: 'García',
    })
    expect('id' in nullId).toBe(false)
    expect('Id' in nullId).toBe(false)
    expect('patientId' in nullId).toBe(false)

    const blankId = buildPatientMePayload({
      id: '   ',
      firstName: 'Juan',
      lastName: 'García',
    })
    expect('id' in blankId).toBe(false)
    expect('Id' in blankId).toBe(false)
    expect('patientId' in blankId).toBe(false)
  })
})

describe('riskAssessment del modelo de ML', () => {
  it('normaliza riskLevel a un vocabulario único (español/inglés)', () => {
    expect(normalizeRiskLevel('bajo')).toBe('bajo')
    expect(normalizeRiskLevel('LOW')).toBe('bajo')
    expect(normalizeRiskLevel('medio')).toBe('medio')
    expect(normalizeRiskLevel('moderate')).toBe('medio')
    expect(normalizeRiskLevel('alto')).toBe('alto')
    expect(normalizeRiskLevel('High')).toBe('alto')
    expect(normalizeRiskLevel('critico')).toBe('critico')
    expect(normalizeRiskLevel('critical')).toBe('critico')
    expect(normalizeRiskLevel('desconocido')).toBeNull()
    expect(normalizeRiskLevel(null)).toBeNull()
    expect(normalizeRiskLevel(42)).toBeNull()
  })

  it('mapea el objeto riskAssessment y degrada objetos vacíos a null', () => {
    expect(
      normalizeRiskAssessment({
        riskLevel: 'medium',
        score: 55.5,
        recommendation: 'Monitorear.',
      }),
    ).toEqual({ riskLevel: 'medio', score: 55.5, recommendation: 'Monitorear.' })
    expect(normalizeRiskAssessment(null)).toBeNull()
    expect(normalizeRiskAssessment('texto')).toBeNull()
    expect(
      normalizeRiskAssessment({ riskLevel: 'x', score: null, recommendation: '' }),
    ).toBeNull()
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

describe('getPrimaryEmergencyContact', () => {
  it('elige el contacto marcado como primario', () => {
    const contacts = [
      { id: 'c2', name: 'Rosa', relationship: 'otro', phone: '+52 55 2222 2222', isPrimary: false },
      { id: 'c1', name: 'María', relationship: 'hijo/a', phone: '+52 55 1111 1111', isPrimary: true },
    ]
    expect(getPrimaryEmergencyContact(contacts)?.name).toBe('María')
  })

  it('cae al primer contacto cuando ninguno es primario', () => {
    const contacts = [
      { id: 'c2', name: 'Rosa', relationship: 'otro', phone: '+52 55 2222 2222', isPrimary: false },
      { id: 'c1', name: 'Ana', relationship: 'padre/madre', phone: '+52 55 3333 3333', isPrimary: false },
    ]
    expect(getPrimaryEmergencyContact(contacts)?.name).toBe('Rosa')
  })

  it('devuelve null con arreglo vacío o ausente', () => {
    expect(getPrimaryEmergencyContact([])).toBeNull()
    expect(getPrimaryEmergencyContact(null)).toBeNull()
    expect(getPrimaryEmergencyContact(undefined)).toBeNull()
  })
})

describe('normalizePatientMe', () => {
  it('rellena los getters de compatibilidad desde el contacto primario', () => {
    const profile = normalizePatientMe({
      firstName: 'Juan',
      lastName: 'García',
      emergencyContacts: [
        { id: 'c2', name: 'Rosa', relationship: 'otro', phone: '+52 55 2222 2222', isPrimary: false },
        { id: 'c1', name: 'María García', relationship: 'hijo/a', phone: '+52 55 1111 1111', email: 'maria@example.com', isPrimary: true },
      ],
    })
    expect(profile.emergencyContactName).toBe('María García')
    expect(profile.emergencyContactPhone).toBe('+52 55 1111 1111')
    expect(profile.emergencyContacts?.length).toBe(2)
  })

  it('respeta los campos planos si el backend aún los envía', () => {
    const profile = normalizePatientMe({
      firstName: 'Juan',
      lastName: 'García',
      emergencyContactName: 'Contacto plano',
      emergencyContactPhone: '+52 55 0000 0000',
    })
    expect(profile.emergencyContactName).toBe('Contacto plano')
    expect(profile.emergencyContactPhone).toBe('+52 55 0000 0000')
  })

  it('admite los nuevos campos de GET /api/patients/me', () => {
    const profile = normalizePatientMe({
      firstName: 'Juan',
      lastName: 'García',
      age: 67,
      initialDiagnosis: 'Hipertensión arterial',
      assignedDoctor: 'Dra. Pérez',
      medications: ['Atorvastatina 10 mg', 'Metoprolol 50 mg cada 12 h'],
      observations: 'Requiere control mensual.',
    })
    expect(profile.age).toBe(67)
    expect(profile.initialDiagnosis).toBe('Hipertensión arterial')
    expect(profile.assignedDoctor).toBe('Dra. Pérez')
    expect(profile.medications).toEqual([
      'Atorvastatina 10 mg',
      'Metoprolol 50 mg cada 12 h',
    ])
    expect(profile.observations).toBe('Requiere control mensual.')
  })

  it('normaliza medications a arreglo plano y filtra entradas vacías', () => {
    const profile = normalizePatientMe({
      firstName: 'Juan',
      lastName: 'García',
      medications: ['  ', 'Aspirina 100 mg'],
    })
    expect(profile.medications).toEqual(['Aspirina 100 mg'])
  })

  it('degrada nulos y ausencias sin romper', () => {
    const profile = normalizePatientMe({
      firstName: 'Juan',
      lastName: 'García',
      age: null,
      initialDiagnosis: null,
      assignedDoctor: null,
      medications: null,
      emergencyContacts: null,
      observations: null,
    })
    expect(profile.age).toBeNull()
    expect(profile.initialDiagnosis).toBeNull()
    expect(profile.medications).toEqual([])
    expect(profile.emergencyContacts).toEqual([])
    expect(profile.observations).toBeNull()
    expect(profile.emergencyContactName).toBeNull()
    expect(profile.emergencyContactPhone).toBeNull()
  })

  it('devuelve un perfil vacío seguro con payload nulo', () => {
    const profile = normalizePatientMe(null)
    expect(profile.firstName).toBe('')
    expect(profile.lastName).toBe('')
    expect(profile.medications).toEqual([])
    expect(profile.emergencyContacts).toEqual([])
  })
})

describe('getMeasurements', () => {
  it('mapea cada lectura al modelo exacto y degrada nulos', async () => {
    setStoredToken('jwt-test')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        okJsonResponse([
          {
            timestamp: '2026-08-13T10:00:00Z',
            deviceId: 'd1',
            bpm: 72,
            quality: null,
            context: null,
            isNormal: true,
            notes: null,
            symptoms: ['mareo', 'dolor de cabeza'],
          },
          {
            timestamp: '2026-08-13T11:00:00Z',
            deviceId: 'd1',
            bpm: 95,
            quality: 'good',
            context: 'rest',
            isNormal: false,
            notes: 'palpitaciones',
            symptoms: null,
          },
        ]),
      ),
    )
    const readings = await getMeasurements()
    expect(readings).toEqual([
      {
        timestamp: '2026-08-13T10:00:00Z',
        deviceId: 'd1',
        bpm: 72,
        quality: null,
        context: null,
        isNormal: true,
        notes: null,
        symptoms: ['mareo', 'dolor de cabeza'],
        riskAssessment: null,
      },
      {
        timestamp: '2026-08-13T11:00:00Z',
        deviceId: 'd1',
        bpm: 95,
        quality: 'good',
        context: 'rest',
        isNormal: false,
        notes: 'palpitaciones',
        symptoms: [],
        riskAssessment: null,
      },
    ])
  })

  it('mapea el riskAssessment del modelo de ML y lo normaliza', async () => {
    setStoredToken('jwt-test')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        okJsonResponse([
          {
            timestamp: '2026-08-13T10:00:00Z',
            deviceId: 'd1',
            bpm: 72,
            quality: null,
            context: null,
            isNormal: true,
            notes: null,
            symptoms: null,
            riskAssessment: {
              riskLevel: 'HIGH',
              score: 68.4,
              recommendation: 'Monitorear la presión arterial esta semana.',
            },
          },
          {
            timestamp: '2026-08-13T11:00:00Z',
            deviceId: 'd1',
            bpm: 60,
            quality: null,
            context: null,
            isNormal: true,
            notes: null,
            symptoms: null,
            riskAssessment: null,
          },
        ]),
      ),
    )
    const readings = await getMeasurements()
    expect(readings[0].riskAssessment).toEqual({
      riskLevel: 'alto',
      score: 68.4,
      recommendation: 'Monitorear la presión arterial esta semana.',
    })
    expect(readings[1].riskAssessment).toBeNull()
  })

  it('degradan riskAssessment vacío o sin datos reconocibles a null', async () => {
    setStoredToken('jwt-test')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        okJsonResponse([
          {
            timestamp: '2026-08-13T10:00:00Z',
            deviceId: 'd1',
            bpm: 72,
            riskAssessment: { riskLevel: 'desconocido', score: null, recommendation: '' },
          },
        ]),
      ),
    )
    const readings = await getMeasurements()
    expect(readings[0].riskAssessment).toBeNull()
  })

  it('devuelve un arreglo vacío si la respuesta no es un arreglo', async () => {
    setStoredToken('jwt-test')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJsonResponse(null)))
    expect(await getMeasurements()).toEqual([])
  })
})

describe('getDailyStatistics', () => {
  it('mapea el resumen diario y degrada campos nulos a 0', async () => {
    setStoredToken('jwt-test')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        okJsonResponse([
          {
            date: '2026-08-12',
            averageBpm: 74,
            minBpm: 61,
            maxBpm: 88,
            totalMeasurements: 12,
            normalMeasurements: 10,
            abnormalMeasurements: 2,
          },
          {
            date: '2026-08-13',
            averageBpm: null,
            minBpm: null,
            maxBpm: null,
            totalMeasurements: null,
            normalMeasurements: null,
            abnormalMeasurements: null,
          },
        ]),
      ),
    )
    const statistics = await getDailyStatistics(
      '2026-08-07T00:00:00Z',
      '2026-08-13T23:59:59Z',
    )
    expect(statistics).toEqual([
      {
        date: '2026-08-12',
        averageBpm: 74,
        minBpm: 61,
        maxBpm: 88,
        totalMeasurements: 12,
        normalMeasurements: 10,
        abnormalMeasurements: 2,
      },
      {
        date: '2026-08-13',
        averageBpm: 0,
        minBpm: 0,
        maxBpm: 0,
        totalMeasurements: 0,
        normalMeasurements: 0,
        abnormalMeasurements: 0,
      },
    ])
  })
})

describe('login: POST /auth/login', () => {
  it('envía las credenciales y platform Web con Content-Type application/json', async () => {
    setStoredToken('jwt-test')
    let capturedUrl = ''
    let capturedInit: RequestInit | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string, init: RequestInit) => {
        capturedUrl = url
        capturedInit = init
        return Promise.resolve(
          okJsonResponse({ token: 'jwt-nuevo', user: { id: 'u1' } }),
        )
      }),
    )
    const response = await apiClient.post(API_ENDPOINTS.auth.login, {
      email: 'ana@example.com',
      password: 'secret123',
      platform: 'Web',
    })
    expect(capturedUrl).toBe(`${API_BASE_URL}/auth/login`)
    expect(capturedUrl.startsWith('http://heartcheckapi.runasp.net/api')).toBe(
      true,
    )
    expect(capturedUrl.startsWith('https://')).toBe(false)
    expect(capturedInit?.method).toBe('POST')
    const headers = capturedInit?.headers as Headers
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(JSON.parse(capturedInit?.body as string)).toEqual({
      email: 'ana@example.com',
      password: 'secret123',
      platform: 'Web',
    })
    expect(response).toEqual({ token: 'jwt-nuevo', user: { id: 'u1' } })
  })

  it('resuelve API_BASE_URL a HTTPS cuando la app corre en un origen HTTPS', async () => {
    const httpsWindow = {
      ...fakeWindow,
      location: { ...fakeWindow.location, protocol: 'https:' },
    }
    ;(globalThis as unknown as { window: typeof httpsWindow }).window =
      httpsWindow
    vi.resetModules()
    const fresh = await import('./apiClient')
    expect(fresh.API_BASE_URL).toBe('https://heartcheckapi.runasp.net/api')
    expect(fresh.API_BASE_URL.startsWith('http://')).toBe(false)
  })

  it('usa la ruta relativa /api en producción cuando el host es onrender.com', async () => {
    const renderWindow = {
      ...fakeWindow,
      location: {
        ...fakeWindow.location,
        protocol: 'https:',
        host: 'heartcheck-web.onrender.com',
      },
    }
    ;(globalThis as unknown as { window: typeof renderWindow }).window =
      renderWindow
    vi.resetModules()
    const fresh = await import('./apiClient')
    expect(fresh.API_BASE_URL).toBe('/api')
    expect(fresh.API_BASE_URL.includes('http')).toBe(false)
  })

  it('mantiene HTTP cuando el origen de la app es HTTP', async () => {
    vi.resetModules()
    const fresh = await import('./apiClient')
    expect(fresh.API_BASE_URL).toBe('http://heartcheckapi.runasp.net/api')
  })

  it('expone el mensaje exacto del backend en errores JSON', async () => {
    setStoredToken('jwt-test')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 400,
        ok: false,
        headers: { get: (): string => 'application/json' },
        json: async (): Promise<unknown> => ({
          message: 'Credenciales inválidas para esta cuenta.',
        }),
      }),
    )
    await expect(
      apiClient.post(API_ENDPOINTS.auth.login, {
        email: 'ana@example.com',
        password: 'x',
        platform: 'Web',
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Credenciales inválidas para esta cuenta.',
    })
  })

  it('extrae el detalle de Problem Details cuando no hay message', async () => {
    setStoredToken('jwt-test')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 500,
        ok: false,
        headers: { get: (): string => 'application/problem+json' },
        json: async (): Promise<unknown> => ({
          type: 'https://tools.ietf.org/html/rfc7231#section-6.6.1',
          title: 'Internal Server Error',
          status: 500,
          detail: 'No se pudo completar la autenticación.',
        }),
      }),
    )
    await expect(
      apiClient.post(API_ENDPOINTS.auth.login, {
        email: 'ana@example.com',
        password: 'x',
        platform: 'Web',
      }),
    ).rejects.toMatchObject({
      status: 500,
      message: 'No se pudo completar la autenticación.',
    })
  })

  it('usa el primer error de validación del diccionario errors', async () => {
    setStoredToken('jwt-test')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 400,
        ok: false,
        headers: { get: (): string => 'application/json' },
        json: async (): Promise<unknown> => ({
          title: 'One or more validation errors occurred.',
          errors: {
            password: ['La contraseña debe tener al menos 8 caracteres.'],
          },
        }),
      }),
    )
    await expect(
      apiClient.post(API_ENDPOINTS.auth.login, {
        email: 'ana@example.com',
        password: 'corta',
        platform: 'Web',
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'La contraseña debe tener al menos 8 caracteres.',
    })
  })

  it('expone el cuerpo de texto plano como mensaje', async () => {
    setStoredToken('jwt-test')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 503,
        ok: false,
        headers: { get: (): string => 'text/plain' },
        text: async (): Promise<string> => 'Service Unavailable',
      }),
    )
    await expect(
      apiClient.post(API_ENDPOINTS.auth.login, {
        email: 'ana@example.com',
        password: 'x',
        platform: 'Web',
      }),
    ).rejects.toMatchObject({ status: 503, message: 'Service Unavailable' })
  })

  it('cae al mensaje genérico solo si el cuerpo no aporta nada', async () => {
    setStoredToken('jwt-test')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 400,
        ok: false,
        headers: { get: (): string => 'application/json' },
        json: async (): Promise<unknown> => ({ status: 400 }),
      }),
    )
    await expect(
      apiClient.post(API_ENDPOINTS.auth.login, {
        email: 'ana@example.com',
        password: 'x',
        platform: 'Web',
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'No se pudo completar la operación. Intente nuevamente.',
    })
  })
})
