import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  AlertTriangle,
  Bell,
  Heart,
  HeartPulse,
  Lock,
  MapPin,
  MessageCircle,
  Phone,
  Pill,
  Plus,
  Save,
  Search,
  Star,
  Stethoscope,
  User,
  Users,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  API_ENDPOINTS,
  NO_PATIENT_LABEL,
  apiClient,
  getDailyStatistics,
  getMeasurements,
  getPatientMe,
  getStoredEmergencyContact,
  getStoredPatientName,
  getStoredUser,
  getUserPlan,
  normalizePhoneForTel,
  setStoredPatient,
  shouldUseMockData,
  updatePatientMe,
} from '../../api/apiClient'
import Sidebar from '../../components/layout/Sidebar'
import RiskAssessmentCard from '../../components/risk/RiskAssessmentCard'
import { getLatestRiskAssessment } from '../../components/risk/riskAssessment'
import type { Alert } from '../../types/alert.types'
import type { Relationship } from '../../types/auth.types'
import type { MeasurementReading } from '../../types/measurement.types'
import type {
  PagedResult,
  PatientMe,
  PatientMeCompatibility,
} from '../../types/patient.types'
import type { DailyStatistic } from '../../types/statistics.types'

interface EmergencyContactInfo {
  name: string
  relationship: string
  phone: string
}

interface PatientProfile {
  fullName: string
  age: number
  address: string
  tutor: string
  contact: EmergencyContactInfo
}

interface ActivityItem {
  id: string
  icon: LucideIcon
  tone: string
  title: string
  detail: string
  time: string
}

interface ClinicalFormState {
  initialDiagnosis: string
  assignedDoctor: string
  observations: string
  medications: string[]
  medicationDraft: string
  emergencyContactName: string
  emergencyRelationship: Relationship
  emergencyPhone: string
  emergencyEmail: string
}

const relationshipOptions: { value: Relationship; label: string }[] = [
  { value: 'spouse', label: 'Cónyuge / Pareja' },
  { value: 'hijo/a', label: 'Hijo/a' },
  { value: 'padre/madre', label: 'Padre / Madre' },
  { value: 'otro', label: 'Otro' },
]

// ObjectId de MongoDB requerido por PUT /api/patients/me: 24 caracteres hex.
const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/

const EMPTY_CLINICAL_FORM: ClinicalFormState = {
  initialDiagnosis: '',
  assignedDoctor: '',
  observations: '',
  medications: [],
  medicationDraft: '',
  emergencyContactName: '',
  emergencyRelationship: 'otro',
  emergencyPhone: '',
  emergencyEmail: '',
}

function clinicalFormFromProfile(
  profile: PatientMe & PatientMeCompatibility | null,
): ClinicalFormState {
  if (!profile) {
    return EMPTY_CLINICAL_FORM
  }
  const primary = profile.emergencyContacts?.find(
    (contact) => contact?.isPrimary === true,
  ) ?? profile.emergencyContacts?.[0]
  return {
    initialDiagnosis: profile.initialDiagnosis ?? '',
    assignedDoctor: profile.assignedDoctor ?? '',
    observations: profile.observations ?? '',
    medications: (profile.medications ?? []).map((item) => item.trim()),
    medicationDraft: '',
    emergencyContactName: primary?.name ?? profile.emergencyContactName ?? '',
    emergencyRelationship: (primary?.relationship as Relationship) || 'otro',
    emergencyPhone: primary?.phone ?? profile.emergencyContactPhone ?? '',
    emergencyEmail: primary?.email ?? '',
  }
}

const TREND_DAYS = 7

const FALLBACK_CONTACT: EmergencyContactInfo = {
  name: '',
  relationship: 'Sin información',
  phone: '',
}

const FALLBACK_PATIENT: PatientProfile = {
  fullName: NO_PATIENT_LABEL,
  age: 0,
  address: 'Dirección no registrada',
  tutor: 'Cuidador',
  contact: FALLBACK_CONTACT,
}

function toArray<T>(payload: T[] | PagedResult<T> | null | undefined): T[] {
  if (Array.isArray(payload)) {
    return payload
  }
  if (payload && Array.isArray(payload.items)) {
    return payload.items
  }
  return []
}

function getAge(birthDate: string): number {
  const birth = new Date(birthDate)
  if (Number.isNaN(birth.getTime())) {
    return 0
  }
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const monthDiff = now.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age -= 1
  }
  return age
}

function formatReportTime(iso: string | null): string {
  if (!iso) {
    return '—'
  }
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }
  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function buildActivityList(
  measurements: MeasurementReading[],
): ActivityItem[] {
  const sorted = [...measurements].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  )
  return sorted.slice(0, 6).map((measurement) => ({
    id: `${measurement.timestamp}-${measurement.bpm}`,
    icon: HeartPulse,
    tone: measurement.isNormal
      ? 'bg-rose-100 text-rose-600'
      : 'bg-amber-100 text-amber-600',
    title: measurement.isNormal
      ? 'Medición de pulso'
      : 'Medición de pulso fuera de rango',
    detail: `${measurement.bpm} BPM${
      measurement.notes ? ` · ${measurement.notes}` : ''
    }`,
    time: formatReportTime(measurement.timestamp),
  }))
}

export default function Pacientes() {
  const location = useLocation()
  const [emergencyOpen, setEmergencyOpen] = useState(false)
  const isPremium = getUserPlan() === 'premium'
  const registrationComplete = Boolean(
    (location.state as { registrationComplete?: boolean } | null)
      ?.registrationComplete,
  )

  const sessionUser = getStoredUser()
  const sessionPersonName = sessionUser
    ? `${sessionUser.firstName} ${sessionUser.lastName}`.trim()
    : ''
  const sessionPatientName = getStoredPatientName()
  // Contacto de emergencia tal como quedó persistido en la sesión/respaldo:
  // primero el del paciente y, si falta, el del usuario/cuidador del registro.
  const sessionEmergency = getStoredEmergencyContact()

  const [patient, setPatient] = useState<PatientProfile>(() => ({
    fullName: sessionPatientName || NO_PATIENT_LABEL,
    age: FALLBACK_PATIENT.age,
    address: FALLBACK_PATIENT.address,
    tutor: sessionPersonName || FALLBACK_PATIENT.tutor,
    contact: {
      name: sessionEmergency.name || sessionPersonName || '',
      relationship: FALLBACK_CONTACT.relationship,
      phone: sessionEmergency.phone,
    },
  }))

  const [readings, setReadings] = useState<MeasurementReading[]>([])
  const [dailyStats, setDailyStats] = useState<DailyStatistic[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  // Perfil crudo de GET /api/patients/me: fuente para editar y guardar la
  // información clínica mediante PUT /api/patients/me.
  const [profile, setProfile] = useState<
    (PatientMe & PatientMeCompatibility) | null
  >(null)

  // Modal de Información Clínica.
  const [clinicalOpen, setClinicalOpen] = useState(false)
  const [clinicalForm, setClinicalForm] =
    useState<ClinicalFormState>(EMPTY_CLINICAL_FORM)
  const [clinicalSaving, setClinicalSaving] = useState(false)
  const [clinicalSaved, setClinicalSaved] = useState(false)
  const [clinicalError, setClinicalError] = useState<string | null>(null)

  const openClinicalModal = (): void => {
    setClinicalForm(clinicalFormFromProfile(profile))
    setClinicalSaved(false)
    setClinicalError(null)
    setClinicalOpen(true)
  }

  const updateClinicalField = <K extends keyof ClinicalFormState>(
    key: K,
    value: ClinicalFormState[K],
  ): void => {
    setClinicalForm((current) => ({ ...current, [key]: value }))
  }

  const addMedication = (): void => {
    const draft = clinicalForm.medicationDraft.trim()
    if (!draft) {
      return
    }
    setClinicalForm((current) => ({
      ...current,
      medications: [...current.medications, draft],
      medicationDraft: '',
    }))
  }

  const removeMedication = (index: number): void => {
    setClinicalForm((current) => ({
      ...current,
      medications: current.medications.filter((_, itemIndex) => itemIndex !== index),
    }))
  }

  const handleClinicalSave = async (): Promise<void> => {
    if (!profile) {
      return
    }
    setClinicalSaving(true)
    setClinicalError(null)
    try {
      // PUT /api/patients/me exige el `id` del paciente (ObjectId de 24
      // caracteres) en el cuerpo del JSON: sin él el backend responde 400
      // "The Id field is required". Se recupera del perfil cargado o, si
      // falta, recargándolo con GET /api/patients/me.
      let patientId = profile.id?.trim() || ''
      if (!patientId) {
        try {
          const fresh = await getPatientMe()
          patientId = fresh.id?.trim() || ''
          setProfile(fresh)
        } catch {
          patientId = ''
        }
      }
      if (!patientId) {
        // Último recurso: el id del usuario autenticado cuando parece un
        // ObjectId hexadecimal de 24 caracteres.
        const sessionId = getStoredUser()?.id?.trim() || ''
        if (OBJECT_ID_REGEX.test(sessionId)) {
          patientId = sessionId
        }
      }
      if (!patientId) {
        setClinicalError(
          'No se pudo obtener el identificador del paciente. Cierra la sesión e inicia sesión de nuevo.',
        )
        return
      }
      const medications = clinicalForm.medications
        .map((item) => item.trim())
        .filter((item) => item !== '')
      // Patch parcial de PUT /api/patients/me: el `id` del paciente viaja
      // obligatoriamente junto a los campos que la API acepta. `initialDiagnosis`
      // y `assignedDoctor` NO se envían: el backend los rechaza con 400.
      const updated = await updatePatientMe({
        id: patientId,
        observations: clinicalForm.observations.trim() || null,
        medications,
        emergencyContacts: [
          {
            name: clinicalForm.emergencyContactName.trim(),
            relationship: clinicalForm.emergencyRelationship,
            phone: clinicalForm.emergencyPhone.trim(),
            email: clinicalForm.emergencyEmail.trim() || null,
            isPrimary: true,
          },
        ],
      })
      setProfile(updated)
      setClinicalSaved(true)
      // El contacto de emergencia actualizado se refleja en el resto de las
      // vistas de la sesión (Dashboard, modal de emergencia).
      setStoredPatient({
        firstName: updated.firstName,
        lastName: updated.lastName,
        emergencyContactName: updated.emergencyContactName ?? null,
        emergencyContactPhone: updated.emergencyContactPhone ?? null,
      })
      setPatient((current) => ({
        ...current,
        contact: {
          ...current.contact,
          name:
            updated.emergencyContactName?.trim() ||
            current.contact.name,
          phone:
            updated.emergencyContactPhone?.trim() || current.contact.phone,
        },
      }))
      window.setTimeout(() => setClinicalOpen(false), 900)
    } catch (error) {
      setClinicalError(
        error instanceof Error ? error.message : 'No se pudo guardar.',
      )
    } finally {
      setClinicalSaving(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    const loadData = async (): Promise<void> => {
      if (shouldUseMockData()) {
        setPatient(FALLBACK_PATIENT)
        setReadings([])
        setDailyStats([])
        setAlerts([])
        return
      }

      try {
        const to = new Date().toISOString()
        const from = new Date(
          Date.now() - TREND_DAYS * 24 * 60 * 60 * 1000,
        ).toISOString()
        const [patientResult, measurementsResult, statisticsResult, alertsResult] =
          await Promise.allSettled([
            getPatientMe(),
            getMeasurements(),
            getDailyStatistics(from, to),
            apiClient.get<Alert[] | PagedResult<Alert>>(
              `${API_ENDPOINTS.alerts.list}?pageSize=20`,
            ),
          ])

        if (cancelled) {
          return
        }

        if (patientResult.status === 'fulfilled' && patientResult.value) {
          const apiPatient = patientResult.value
          setProfile(apiPatient)
          const storedEmergency = getStoredEmergencyContact()
          const apiFullName =
            `${apiPatient.firstName} ${apiPatient.lastName}`.trim()
          // Persiste el perfil (incluido el contacto de emergencia) en la
          // sesión y el respaldo local para el resto de las vistas.
          if (apiFullName) {
            setStoredPatient({
              firstName: apiPatient.firstName,
              lastName: apiPatient.lastName,
              emergencyContactName: apiPatient.emergencyContactName ?? null,
              emergencyContactPhone:
                apiPatient.emergencyContactPhone ?? null,
            })
          }
          setPatient({
            fullName: apiFullName || sessionPatientName || NO_PATIENT_LABEL,
            age:
              apiPatient.age ??
              (apiPatient.dateOfBirth
                ? getAge(apiPatient.dateOfBirth)
                : FALLBACK_PATIENT.age),
            address:
              apiPatient.address?.trim() || FALLBACK_PATIENT.address,
            tutor: sessionPersonName || FALLBACK_PATIENT.tutor,
            contact: {
              name:
                apiPatient.emergencyContactName?.trim() ||
                storedEmergency.name ||
                sessionPersonName ||
                '',
              relationship: FALLBACK_CONTACT.relationship,
              phone:
                apiPatient.emergencyContactPhone?.trim() ||
                storedEmergency.phone,
            },
          })
        }

        if (measurementsResult.status === 'fulfilled') {
          const list = toArray(measurementsResult.value)
          if (list.length > 0) {
            setReadings(list)
          }
        }

        if (statisticsResult.status === 'fulfilled') {
          const list = toArray(statisticsResult.value)
          if (list.length > 0) {
            setDailyStats(list)
          }
        }

        if (alertsResult.status === 'fulfilled') {
          const list = toArray(alertsResult.value)
          if (list.length > 0) {
            setAlerts(list)
          }
        }
      } catch {
        if (cancelled) {
          return
        }
        setPatient(FALLBACK_PATIENT)
        setReadings([])
        setDailyStats([])
        setAlerts([])
      }
    }

    void loadData()
    return () => {
      cancelled = true
    }
  }, [sessionPatientName, sessionPersonName])

  const sortedReadings = [...readings].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  )
  const latestReading = sortedReadings[0] ?? null
  const latestBpm = latestReading?.bpm ?? 0

  // Tendencia diaria real de GET /api/statistics/daily (últimos 7 días).
  const trendStats = [...dailyStats]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-TREND_DAYS)
  const trendMax = Math.max(
    60,
    ...trendStats.map((stat) => stat.averageBpm),
    ...readings.map((reading) => reading.bpm),
  )
  const trendBars = trendStats.map((stat) =>
    Math.min(100, Math.round((stat.averageBpm / trendMax) * 100)),
  )
  const averageBpm =
    trendStats.length > 0
      ? Math.round(
          trendStats.reduce((sum, stat) => sum + stat.averageBpm, 0) /
            trendStats.length,
        )
      : readings.length > 0
        ? Math.round(
            readings.reduce((sum, reading) => sum + reading.bpm, 0) /
              readings.length,
          )
        : 0
  const totalMeasurements =
    trendStats.reduce((sum, stat) => sum + stat.totalMeasurements, 0) ||
    readings.length

  const activeAlerts = alerts.filter((alert) => alert.status === 'Active')
  const latestAlert = activeAlerts[0] ?? null

  const activity = buildActivityList(readings)
  const emergencyPhone = normalizePhoneForTel(patient.contact.phone)
  const latestRisk = getLatestRiskAssessment(readings)
  // Solo se muestra el aviso de vacío si no hay nombre NI teléfono válidos.
  const hasEmergencyContact = Boolean(
    patient.contact.name.trim() || patient.contact.phone.trim(),
  )
  const emergencyInitials = patient.contact.name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />

      <main className="min-h-screen p-4 sm:p-6 lg:ml-64">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block w-full max-w-sm">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              placeholder="Search patient or log..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </label>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setEmergencyOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-red-700"
            >
              🚨 Emergencia (Alerta)
            </button>
            <button
              type="button"
              aria-label="Notificaciones"
              className="relative rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
            >
              <Bell className="size-5" aria-hidden="true" />
              <span
                className="absolute right-2 top-2 size-2.5 rounded-full bg-red-500 ring-2 ring-white"
                aria-hidden="true"
              />
            </button>
            <button
              type="button"
              aria-label="Mensajes"
              className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
            >
              <MessageCircle className="size-5" aria-hidden="true" />
            </button>
          </div>
        </header>

        {registrationComplete && (
          <div
            role="status"
            className="mt-6 flex flex-col gap-4 rounded-2xl border border-blue-200 bg-blue-50 p-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-600">
                <Stethoscope className="size-5 text-white" aria-hidden="true" />
              </span>
              <div>
                <p className="font-semibold text-blue-950">
                  ¡Cuenta creada correctamente!
                </p>
                <p className="mt-0.5 text-sm text-blue-800/80">
                  Completa la información clínica del paciente para que el
                  monitoreo y las tendencias sean más precisos.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={openClinicalModal}
              className="shrink-0 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700"
            >
              Completar Información Clínica
            </button>
          </div>
        )}

        <section className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-blue-950">
              Pacientes
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Gestiona la salud de tus pacientes.
            </p>
          </div>
          <button
            type="button"
            disabled
            title="Disponible en Plan Premium"
            className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-400"
          >
            <Lock className="size-4" aria-hidden="true" />
            Añadir Paciente
          </button>
        </section>

        <section className="mt-6 flex flex-col gap-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:flex-row">
          <div className="flex flex-1 flex-col gap-5 p-6 sm:flex-row sm:items-center">
            <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-blue-100">
              <User className="size-8 text-blue-600" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900">
                  {patient.fullName}
                </h2>
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                  ESTABLE
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  PLAN BÁSICO
                </span>
              </div>
              <div className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <p className="flex items-center gap-2 text-slate-600">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Tutor
                  </span>
                  <span className="font-medium text-slate-800">
                    {patient.tutor}
                  </span>
                </p>
                <p className="flex items-center gap-2 text-slate-600">
                  <MapPin className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
                  <span className="truncate">{patient.address}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-between gap-3 bg-gradient-to-br from-blue-600 to-indigo-700 p-6 text-white lg:w-80">
            <div>
              <div className="flex items-center gap-2">
                <Star className="size-5 fill-current" aria-hidden="true" />
                <h3 className="font-bold">Pásate a Premium</h3>
              </div>
              <p className="mt-2 text-sm text-blue-100">
                Análisis predictivos, reportes médicos y alertas prioritarias
                para cuidar mejor a tus pacientes.
              </p>
            </div>
            <Link
              to="/planes"
              className="inline-flex items-center justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50"
            >
              Actualizar ahora
            </Link>
          </div>
        </section>

        <section className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Resumen de Salud
              </p>
              <span className="flex size-9 items-center justify-center rounded-full bg-red-100">
                <Heart className="size-5 text-red-500" aria-hidden="true" />
              </span>
            </div>
            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="text-4xl font-extrabold text-slate-900">
                {latestBpm > 0 ? latestBpm : '--'}
              </span>
              <span className="text-lg font-semibold text-slate-500">BPM</span>
              {latestReading && (
                <span className="ml-auto text-xs text-slate-400">
                  Última lectura: {formatReportTime(latestReading.timestamp)}
                </span>
              )}
            </div>
            <div className="mt-4 flex h-10 items-end gap-1.5" aria-hidden="true">
              {trendBars.map((height, index) => (
                <span
                  key={index}
                  className="w-2 rounded-full bg-rose-300"
                  style={{ height: `${height}%` }}
                />
              ))}
              {trendBars.length === 0 && (
                <span className="text-xs text-slate-400">
                  Sin datos de tendencia todavía.
                </span>
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-500">Promedio BPM</p>
                <p className="font-semibold text-slate-800">
                  {averageBpm > 0 ? averageBpm : '—'}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-500">Mediciones</p>
                <p className="font-semibold text-slate-800">
                  {totalMeasurements}
                </p>
              </div>
            </div>
            {activeAlerts.length > 0 && latestAlert ? (
              <p className="mt-4 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-700">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  {activeAlerts.length} alerta
                  {activeAlerts.length > 1 ? 's' : ''} activa
                  {activeAlerts.length > 1 ? 's' : ''}: {latestAlert.message}
                </span>
              </p>
            ) : (
              <p className="mt-4 flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-700">
                <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                Sin alertas activas
              </p>
            )}
            {/* Análisis Predictivo (ML): datos reales en Premium, callout
                bloqueado en el plan básico. Nunca rompe con datos nulos. */}
            <div className="mt-4">
              <RiskAssessmentCard
                riskAssessment={latestRisk}
                locked={!isPremium}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Contacto de Emergencia
              </p>
              <span className="flex size-9 items-center justify-center rounded-full bg-emerald-100">
                <Phone className="size-5 text-emerald-600" aria-hidden="true" />
              </span>
            </div>
            {hasEmergencyContact ? (
              <>
                <div className="mt-4 flex items-center gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                    {emergencyInitials || 'EC'}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">
                      {patient.contact.name}
                    </p>
                    <p className="truncate text-sm text-slate-500">
                      {patient.contact.relationship}
                    </p>
                  </div>
                </div>
                {emergencyPhone ? (
                  <>
                    <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700">
                      {patient.contact.phone}
                    </p>
                    <a
                      href={`tel:${emergencyPhone}`}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                    >
                      <Phone className="size-4" aria-hidden="true" />
                      Llamar ahora
                    </a>
                  </>
                ) : (
                  <p className="mt-4 text-sm text-slate-500">
                    No hay un teléfono de emergencia válido.
                  </p>
                )}
              </>
            ) : (
              <p className="mt-4 text-sm text-slate-500">
                No hay un teléfono de emergencia válido.
              </p>
            )}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-100">
                <Stethoscope className="size-5 text-blue-600" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Expediente Clínico &amp; Medicación
                </h3>
                <p className="text-xs text-slate-500">
                  Diagnóstico, médico tratante y medicación del paciente.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={openClinicalModal}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100"
            >
              <Pill className="size-4" aria-hidden="true" />
              Editar Expediente
            </button>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Diagnóstico Inicial
              </p>
              <p className="mt-1 text-sm font-medium text-slate-800">
                {profile?.initialDiagnosis?.trim() || '—'}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Médico Asignado
              </p>
              <p className="mt-1 text-sm font-medium text-slate-800">
                {profile?.assignedDoctor?.trim() || '—'}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Medicamentos
            </p>
            {profile?.medications?.length ? (
              <ul className="mt-2 flex flex-wrap gap-2">
                {profile.medications.map((medication, index) => (
                  <li
                    key={`${medication}-${index}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-800"
                  >
                    <Pill className="size-3.5 shrink-0 text-blue-500" aria-hidden="true" />
                    {medication}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                Sin medicamentos registrados
              </p>
            )}
          </div>

          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Observaciones Clínicas
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
              {profile?.observations?.trim() ||
                'Sin observaciones registradas.'}
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Registro de Actividad
            </h3>
            <span className="flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
              <span className="size-1.5 rounded-full bg-sky-500" aria-hidden="true" />
              En tiempo real
            </span>
          </div>
          {activity.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              Sin mediciones registradas todavía.
            </p>
          ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {activity.map((item) => (
              <li key={item.id} className="flex items-center gap-4 py-3">
                <span
                  className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${item.tone}`}
                >
                  <item.icon className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800">
                    {item.title}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {item.detail}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-medium text-slate-500">
                  {item.time}
                </span>
              </li>
            ))}
          </ul>
          )}
        </section>

        <section className="mt-6 flex flex-col items-start justify-between gap-4 rounded-2xl bg-gradient-to-br from-indigo-700 to-violet-700 p-6 text-white shadow-lg sm:flex-row sm:items-center">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/10">
              <Users className="size-6" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-lg font-bold">Añade a tu familia completa</h3>
              <p className="mt-1 max-w-xl text-sm text-indigo-100">
                Vincula hasta 4 integrantes y monitorea la salud de todos con un
                solo plan compartido.
              </p>
            </div>
          </div>
          <Link
            to="/planes"
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-50"
          >
            <HeartPulse className="size-4" aria-hidden="true" />
            Ver planes
          </Link>
        </section>
      </main>

      {emergencyOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="emergency-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          onClick={() => setEmergencyOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <span className="flex size-12 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="size-6 text-red-600" aria-hidden="true" />
              </span>
              <button
                type="button"
                onClick={() => setEmergencyOpen(false)}
                aria-label="Cerrar"
                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <h2 id="emergency-title" className="mt-4 text-lg font-bold text-slate-900">
              ¿Confirmar llamada de emergencia?
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Se contactará de inmediato al número de emergencia configurado
              para {patient.fullName}.
            </p>
            {hasEmergencyContact && emergencyPhone && (
              <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                <p className="font-semibold text-slate-900">
                  {patient.contact.name || 'Contacto de emergencia'}
                </p>
                <a
                  href={`tel:${emergencyPhone}`}
                  className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:underline"
                >
                  <Phone className="size-4" aria-hidden="true" />
                  {patient.contact.phone}
                </a>
              </div>
            )}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setEmergencyOpen(false)}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => setEmergencyOpen(false)}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-700"
              >
                Llama ahora
              </button>
            </div>
          </div>
        </div>
      )}

      {clinicalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="clinical-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          onClick={() => setClinicalOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-full bg-blue-100">
                  <Stethoscope className="size-5 text-blue-600" aria-hidden="true" />
                </span>
                <div>
                  <h2 id="clinical-title" className="text-lg font-bold text-slate-900">
                    Información Clínica
                  </h2>
                  <p className="text-xs text-slate-500">
                    Actualiza tu expediente clínico y contactos de emergencia.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setClinicalOpen(false)}
                aria-label="Cerrar"
                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            {clinicalSaved ? (
              <p
                role="status"
                className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
              >
                Información clínica guardada correctamente.
              </p>
            ) : (
              <div className="mt-5 space-y-4">
                {clinicalError && (
                  <p
                    role="alert"
                    className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800"
                  >
                    {clinicalError}
                  </p>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="clinical-diagnosis"
                      className="block text-sm font-medium text-slate-700"
                    >
                      Diagnóstico inicial
                    </label>
                    <input
                      id="clinical-diagnosis"
                      value={clinicalForm.initialDiagnosis}
                      onChange={(event) =>
                        updateClinicalField('initialDiagnosis', event.target.value)
                      }
                      placeholder="Ej. Hipertensión arterial"
                      className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="clinical-doctor"
                      className="block text-sm font-medium text-slate-700"
                    >
                      Médico tratante
                    </label>
                    <input
                      id="clinical-doctor"
                      value={clinicalForm.assignedDoctor}
                      onChange={(event) =>
                        updateClinicalField('assignedDoctor', event.target.value)
                      }
                      placeholder="Ej. Dra. Pérez"
                      className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="clinical-observations"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Observaciones
                  </label>
                  <textarea
                    id="clinical-observations"
                    value={clinicalForm.observations}
                    onChange={(event) =>
                      updateClinicalField('observations', event.target.value)
                    }
                    placeholder="Ej. Requiere control mensual de presión."
                    rows={3}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="clinical-medications"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Medicamentos
                  </label>
                  <div className="mt-1.5 flex gap-2">
                    <input
                      id="clinical-medications"
                      value={clinicalForm.medicationDraft}
                      onChange={(event) =>
                        updateClinicalField('medicationDraft', event.target.value)
                      }
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          addMedication()
                        }
                      }}
                      placeholder="Ej. Atorvastatina 10 mg"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                    <button
                      type="button"
                      onClick={addMedication}
                      aria-label="Agregar medicamento"
                      className="flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-50 px-3.5 py-2.5 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100"
                    >
                      <Plus className="size-4" aria-hidden="true" />
                      Agregar
                    </button>
                  </div>
                  {clinicalForm.medications.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-400">
                      Sin medicamentos registrados
                    </p>
                  ) : (
                    <ul className="mt-2.5 flex flex-wrap gap-2">
                      {clinicalForm.medications.map((medication, index) => (
                        <li
                          key={`${medication}-${index}`}
                          className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 py-1 pl-3 pr-1.5 text-sm text-blue-800"
                        >
                          <Pill className="size-3.5 shrink-0 text-blue-500" aria-hidden="true" />
                          <span className="truncate">{medication}</span>
                          <button
                            type="button"
                            onClick={() => removeMedication(index)}
                            aria-label={`Quitar ${medication}`}
                            className="rounded-full p-1 text-blue-400 transition-colors hover:bg-blue-100 hover:text-blue-700"
                          >
                            <X className="size-3.5" aria-hidden="true" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-400">
                    <Pill className="size-3.5" aria-hidden="true" />
                    Presiona Enter o «Agregar» para incluir cada medicamento.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-800">
                    Contacto de emergencia
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <input
                      value={clinicalForm.emergencyContactName}
                      onChange={(event) =>
                        updateClinicalField(
                          'emergencyContactName',
                          event.target.value,
                        )
                      }
                      placeholder="Nombre del contacto"
                      aria-label="Nombre del contacto de emergencia"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                    <select
                      value={clinicalForm.emergencyRelationship}
                      onChange={(event) =>
                        updateClinicalField(
                          'emergencyRelationship',
                          event.target.value as Relationship,
                        )
                      }
                      aria-label="Parentesco del contacto"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    >
                      {relationshipOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <input
                      value={clinicalForm.emergencyPhone}
                      onChange={(event) =>
                        updateClinicalField('emergencyPhone', event.target.value)
                      }
                      placeholder="Teléfono +52 55 0000 0000"
                      aria-label="Teléfono del contacto de emergencia"
                      type="tel"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                    <input
                      value={clinicalForm.emergencyEmail}
                      onChange={(event) =>
                        updateClinicalField('emergencyEmail', event.target.value)
                      }
                      placeholder="Correo del contacto"
                      aria-label="Correo del contacto de emergencia"
                      type="email"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  disabled={clinicalSaving || !profile}
                  onClick={() => void handleClinicalSave()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save className="size-4" aria-hidden="true" />
                  {clinicalSaving ? 'Guardando…' : 'Guardar Información Clínica'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
