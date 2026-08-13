import type { BloodGroup } from './auth.types'

export type Gender = 'Male' | 'Female' | 'Other'

/**
 * Contacto de emergencia tal como lo devuelve `GET /api/patients/me` dentro
 * del arreglo `emergencyContacts`.
 */
export interface EmergencyContact {
  id?: string | null
  name: string
  relationship: string
  phone: string
  email?: string | null
  isPrimary?: boolean
}

/**
 * Perfil del paciente autenticado tal como lo espera la API de producción en
 * `GET/PUT /api/patients/me`. Los apellidos se envían concatenados en
 * `lastName`; el frontend nunca envía `secondLastName`.
 */
export interface PatientMeRequest {
  firstName: string
  lastName: string
  phone?: string | null
  dateOfBirth?: string | null
  gender?: Gender | null
  bloodType?: BloodGroup | null
  emergencyContactName?: string | null
  emergencyContactPhone?: string | null
  address?: string | null
}

export interface PatientMe extends PatientMeRequest {
  id?: string | null
  email?: string | null
  createdAt?: string | null
  /**
   * Edad calculada en años, devuelta directamente por el backend
   * (`GET /api/patients/me`). Es un entero; la UI nunca la deriva de
   * `dateOfBirth` cuando viene presente.
   */
  age?: number | null
  initialDiagnosis?: string | null
  assignedDoctor?: string | null
  /**
   * Medicación como arreglo plano de textos (p. ej. `["Atorvastatina 10 mg",
   * "Metoprolol 50 mg cada 12 h"]`). La UI no parsea dosis/frecuencia por
   * separado; cada entrada se muestra como texto libre.
   */
  medications?: string[] | null
  emergencyContacts?: EmergencyContact[] | null
  observations?: string | null
}

/**
 * Getters de compatibilidad para la UI existente que lee el contacto de
 * emergencia primario como propiedades raíz (`emergencyContactName` /
 * `emergencyContactPhone`) en lugar del arreglo `emergencyContacts`.
 */
export interface PatientMeCompatibility {
  emergencyContactName?: string | null
  emergencyContactPhone?: string | null
}

export interface Patient {
  id: string
  firstName: string
  lastName: string
  secondLastName?: string | null
  birthDate: string
  gender: Gender
  phone: string | null
  email: string | null
  medicalHistory: string | null
  address?: string | null
  tutor?: string | null
  emergencyContacts?: EmergencyContact[] | null
  isActive: boolean
  createdAt: string
}

export interface CreatePatientRequest {
  firstName: string
  lastName: string
  secondLastName?: string
  birthDate: string
  gender: Gender
  phone?: string
  email?: string
  medicalHistory?: string
}

export interface UpdatePatientRequest {
  firstName?: string
  lastName?: string
  secondLastName?: string
  birthDate?: string
  gender?: Gender
  phone?: string
  email?: string
  medicalHistory?: string
  isActive?: boolean
}

export interface PatientListQuery {
  search?: string
  isActive?: boolean
  page?: number
  pageSize?: number
}

export interface PagedResult<T> {
  items: T[]
  totalItems: number
  page: number
  pageSize: number
  totalPages: number
}
