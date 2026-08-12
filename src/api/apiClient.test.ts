import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearSession,
  getStoredToken,
  getStoredUser,
  isAuthenticated,
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
