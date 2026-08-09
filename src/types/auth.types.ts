export type UserRole = 'Admin' | 'Medic' | 'Nurse'

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  firstName: string
  lastName: string
  phone: string
}

export type BloodGroup = 'O+' | 'O-' | 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-'

export type Relationship =
  | 'spouse'
  | 'hijo/a'
  | 'padre/madre'
  | 'otro'

export interface PatientProfile {
  fullName: string
  age: number | null
  weight: number | null
  height: number | null
  address: string
  bloodType: BloodGroup
  observations: string
  diagnosis: string
  treatingPhysician: string
}

export interface EmergencyContact {
  name: string
  relationship: Relationship
  phone: string
  email: string
  isPrimary: boolean
}

export interface MedicationRegistration {
  name: string
  dosage: string
  frequency: string
  timeOfDay: string
}

export interface ClinicalRegisterRequest {
  caregiverName: string
  email: string
  phone: string
  password: string
  patientProfile: PatientProfile
  emergencyContact: EmergencyContact
  medications: MedicationRegistration[]
}

export interface RegisterResponse {
  token?: string
}

export interface UserDto {
  id: string
  firstName: string
  lastName: string
  email: string
  role: UserRole
}

export interface LoginResponse {
  token: string
  user: UserDto
  expiresAt: string
}

export interface AuthErrorResponse {
  status?: number
  message?: string
  errors?: Record<string, string[]>
}