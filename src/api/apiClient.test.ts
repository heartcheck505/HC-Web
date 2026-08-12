import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearSession,
  getStoredToken,
  getStoredUser,
  isAuthenticated,
  normalizeStoredUser,
  setStoredToken,
  setStoredUser,
  shouldUseMockData,
} from './apiClient'

const storage = new Map<string, string>()

const fakeWindow = {
  sessionStorage: {
    getItem: (key: string): string | null => storage.get(key) ?? null,
    setItem: (key: string, value: string): void => {
      storage.set(key, value)
    },
    removeItem: (key: string): void => {
      storage.delete(key)
    },
  },
  location: {
    pathname: '/dashboard',
    search: '',
    assign: (): undefined => undefined,
  },
}

beforeEach(() => {
  storage.clear()
  vi.stubEnv('VITE_USE_MOCK_DATA', undefined)
  ;(globalThis as unknown as { window: typeof fakeWindow }).window = fakeWindow
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
    storage.set('heartcheck.user', '{no-json')
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
})
