export type UserRole = 'Admin' | 'Medic' | 'Nurse'

export type UserPlan = 'basic' | 'premium'

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  firstName: string
  lastName: string
  secondLastName?: string
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
  user?: UserDto
  /** Nombre completo tal como lo devuelven algunos backends. */
  nombre?: string
  /** Licencia/plan seleccionado al registrarse. */
  plan?: UserPlan
}

export interface UserDto {
  id: string
  firstName: string
  lastName: string
  secondLastName?: string
  email: string
  role: UserRole
  /** Licencia/plan de suscripción. Ausente se interpreta como `basic`. */
  plan?: UserPlan
  /** Datos del paciente/tutor registrados, persistidos en la sesión. */
  patient?: StoredPatient
  /** Contacto de emergencia del perfil del cuidador/registro. */
  emergencyContactName?: string | null
  emergencyContactPhone?: string | null
}

export interface StoredPatient {
  firstName: string
  lastName: string
  secondLastName?: string
  emergencyContactName?: string | null
  emergencyContactPhone?: string | null
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
