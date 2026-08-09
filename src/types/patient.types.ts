export type Gender = 'Male' | 'Female' | 'Other'

export interface EmergencyContact {
  name: string
  relationship: string
  phone: string
}

export interface Patient {
  id: string
  firstName: string
  lastName: string
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
  birthDate: string
  gender: Gender
  phone?: string
  email?: string
  medicalHistory?: string
}

export interface UpdatePatientRequest {
  firstName?: string
  lastName?: string
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