import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Battery,
  Bell,
  Heart,
  HeartPulse,
  Lock,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  Star,
  User,
  Users,
  Watch,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { API_ENDPOINTS, apiClient, getStoredPatientName, getStoredPhone, getStoredUser, setStoredPatientName, setStoredPhone, shouldUseMockData } from '../../api/apiClient'
import Sidebar from '../../components/layout/Sidebar'
import RegisterDeviceModal from '../../components/devices/RegisterDeviceModal'
import type { Device } from '../../types/device.types'
import type { Measurement } from '../../types/measurement.types'
import type { Patient, PagedResult } from '../../types/patient.types'

const heartRateBars = [40, 52, 46, 70, 52, 76, 60, 64, 48, 68, 55, 72]

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

interface DeviceInfo {
  model: string
  batteryLevel: number
  lastSyncAt: string | null
}

interface ActivityItem {
  id: string
  icon: LucideIcon
  tone: string
  title: string
  detail: string
  time: string
}

const FALLBACK_CONTACT: EmergencyContactInfo = {
  name: 'Cuidador',
  relationship: 'Familiar directo',
  phone: '+56 9 0000 0000',
}

const FALLBACK_PATIENT: PatientProfile = {
  fullName: 'Paciente',
  age: 68,
  address: 'Dirección no registrada',
  tutor: 'Cuidador',
  contact: FALLBACK_CONTACT,
}

const FALLBACK_DEVICE: DeviceInfo = {
  model: 'Smartwatch G3',
  batteryLevel: 42,
  lastSyncAt: null,
}

function buildFallbackMeasurements(now: Date): Measurement[] {
  return [
    {
      id: 'fb-m1',
      patientId: 'fallback',
      deviceId: 'fallback',
      heartRate: 74,
      systolic: 122,
      diastolic: 80,
      spo2: 96,
      respiratoryRate: 15,
      temperature: 36.5,
      recordedAt: new Date(now.getTime() - 45 * 60 * 1000).toISOString(),
    },
    {
      id: 'fb-m2',
      patientId: 'fallback',
      deviceId: 'fallback',
      heartRate: 79,
      systolic: 124,
      diastolic: 81,
      spo2: 95,
      respiratoryRate: 16,
      temperature: 36.4,
      recordedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'fb-m3',
      patientId: 'fallback',
      deviceId: 'fallback',
      heartRate: 71,
      systolic: 121,
      diastolic: 78,
      spo2: 97,
      respiratoryRate: 15,
      temperature: 36.6,
      recordedAt: new Date(now.getTime() - 26 * 60 * 60 * 1000).toISOString(),
    },
  ]
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
  measurements: Measurement[],
  device: DeviceInfo,
): ActivityItem[] {
  const sorted = [...measurements].sort(
    (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
  )
  return [
    {
      id: 'activity-sync',
      icon: Watch,
      tone: 'bg-sky-100 text-sky-600',
      title: 'Sincronización del Smartwatch',
      detail: `${device.model} · Batería ${device.batteryLevel}%`,
      time: device.lastSyncAt ? formatReportTime(device.lastSyncAt) : 'Hace 5 min',
    },
    ...sorted.slice(0, 6).map((measurement) => ({
      id: measurement.id,
      icon: HeartPulse,
      tone: 'bg-rose-100 text-rose-600',
      title: 'Medición de pulso',
      detail: `${measurement.heartRate} BPM · SpO₂ ${measurement.spo2}% · TA ${measurement.systolic}/${measurement.diastolic}`,
      time: formatReportTime(measurement.recordedAt),
    })),
  ]
}

export default function Pacientes() {
  const toastTimer = useRef<number | null>(null)
  const [emergencyOpen, setEmergencyOpen] = useState(false)
  const [deviceModalOpen, setDeviceModalOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const sessionUser = getStoredUser()
  const sessionPatientName = getStoredPatientName()
  const sessionPhone = getStoredPhone()
  const sessionPersonName = sessionUser
    ? `${sessionUser.firstName} ${sessionUser.lastName}`.trim()
    : ''

  const [patient, setPatient] = useState<PatientProfile>(() => ({
    fullName: sessionPatientName || FALLBACK_PATIENT.fullName,
    age: FALLBACK_PATIENT.age,
    address: FALLBACK_PATIENT.address,
    tutor: sessionPersonName || FALLBACK_PATIENT.tutor,
    contact: {
      name: sessionPersonName || FALLBACK_CONTACT.name,
      relationship: FALLBACK_CONTACT.relationship,
      phone: sessionPhone || FALLBACK_CONTACT.phone,
    },
  }))

  const showToast = (message: string): void => {
    if (toastTimer.current !== null) {
      window.clearTimeout(toastTimer.current)
    }
    setToast(message)
    toastTimer.current = window.setTimeout(() => {
      setToast(null)
      toastTimer.current = null
    }, 3500)
  }
  const [device, setDevice] = useState<DeviceInfo>(FALLBACK_DEVICE)
  const [measurements, setMeasurements] = useState<Measurement[]>(() =>
    buildFallbackMeasurements(new Date()),
  )

  useEffect(() => {
    let cancelled = false

    const loadData = async (): Promise<void> => {
      if (shouldUseMockData()) {
        setPatient(FALLBACK_PATIENT)
        setDevice(FALLBACK_DEVICE)
        setMeasurements(buildFallbackMeasurements(new Date()))
        return
      }

      try {
        const [patientResult, deviceResult, measurementResult] =
          await Promise.allSettled([
            apiClient.get<Patient>(API_ENDPOINTS.patients.me),
            apiClient.get<Device[] | PagedResult<Device>>(
              `${API_ENDPOINTS.devices.list}?page=1&pageSize=1`,
            ),
            apiClient.get<Measurement[] | PagedResult<Measurement>>(
              `${API_ENDPOINTS.measurements.list}?page=1&pageSize=10`,
            ),
          ])

        if (cancelled) {
          return
        }

        if (patientResult.status === 'fulfilled' && patientResult.value) {
          const apiPatient = patientResult.value
          const contact = apiPatient.emergencyContacts?.[0]
          const apiFullName = `${apiPatient.firstName} ${apiPatient.lastName}`.trim()
          if (apiFullName) {
            setStoredPatientName(apiFullName)
          }
          if (contact?.phone) {
            setStoredPhone(contact.phone)
          }
          setPatient({
            fullName: apiFullName || FALLBACK_PATIENT.fullName,
            age: apiPatient.birthDate
              ? (getAge(apiPatient.birthDate) || FALLBACK_PATIENT.age)
              : FALLBACK_PATIENT.age,
            address:
              apiPatient.address?.trim() || FALLBACK_PATIENT.address,
            tutor: apiPatient.tutor?.trim() || sessionPersonName || FALLBACK_PATIENT.tutor,
            contact: {
              name: contact?.name?.trim() || sessionPersonName || FALLBACK_CONTACT.name,
              relationship:
                contact?.relationship?.trim() || FALLBACK_CONTACT.relationship,
              phone: contact?.phone?.trim() || sessionPhone || FALLBACK_CONTACT.phone,
            },
          })
        }

        if (deviceResult.status === 'fulfilled') {
          const firstDevice = toArray(deviceResult.value)[0]
          if (firstDevice) {
            setDevice({
              model: firstDevice.model || FALLBACK_DEVICE.model,
              batteryLevel:
                firstDevice.batteryLevel ?? FALLBACK_DEVICE.batteryLevel,
              lastSyncAt: firstDevice.lastSyncAt,
            })
          }
        }

        if (measurementResult.status === 'fulfilled') {
          const list = toArray(measurementResult.value)
          if (list.length > 0) {
            setMeasurements(list)
          }
        }
      } catch {
        if (cancelled) {
          return
        }
        setPatient(FALLBACK_PATIENT)
        setDevice(FALLBACK_DEVICE)
        setMeasurements(buildFallbackMeasurements(new Date()))
      }
    }

    void loadData()
    return () => {
      cancelled = true
    }
  }, [])

  const sortedMeasurements = [...measurements].sort(
    (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
  )
  const latest = sortedMeasurements[0] ?? null
  const latestBpm = latest?.heartRate ?? 72
  const spo2 = latest?.spo2 ?? 96
  const latestSys = latest?.systolic ?? 122
  const latestDia = latest?.diastolic ?? 80

  const activity = buildActivityList(measurements, device)

  const batteryColor =
    device.batteryLevel >= 50
      ? 'bg-emerald-500'
      : device.batteryLevel >= 30
        ? 'bg-amber-500'
        : 'bg-rose-500'

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

        <section className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-blue-950">
              Pacientes
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Gestiona la salud y el dispositivo de tus pacientes.
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

        <section className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Conexión y Batería
              </p>
              <span className="flex size-9 items-center justify-center rounded-full bg-sky-100">
                <Watch className="size-5 text-sky-600" aria-hidden="true" />
              </span>
            </div>
            <p className="mt-4 text-lg font-bold text-slate-900">
              {device.model}
            </p>
            <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              Conectado
            </span>
            <div className="mt-5">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <Battery className="size-4" aria-hidden="true" />
                  Batería
                </span>
                <span className="font-semibold text-slate-800">
                  {device.batteryLevel}%
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${batteryColor}`}
                  style={{ width: `${device.batteryLevel}%` }}
                />
              </div>
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Última sincronización:{' '}
              {device.lastSyncAt
                ? formatReportTime(device.lastSyncAt)
                : 'hace 5 minutos'}
            </p>
            <button
              type="button"
              onClick={() => setDeviceModalOpen(true)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-blue-600 py-2.5 text-sm font-semibold text-blue-600 transition-colors hover:bg-blue-50"
            >
              <Watch className="size-4" aria-hidden="true" />
              Vincular dispositivo
            </button>
          </div>

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
                {latestBpm}
              </span>
              <span className="text-lg font-semibold text-slate-500">BPM</span>
            </div>
            <div className="mt-4 flex h-10 items-end gap-1.5" aria-hidden="true">
              {heartRateBars.map((height, index) => (
                <span
                  key={index}
                  className="w-2 rounded-full bg-rose-300"
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-500">Saturación O₂</p>
                <p className="font-semibold text-slate-800">{spo2}%</p>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-500">Presión</p>
                <p className="font-semibold text-slate-800">
                  {latestSys}/{latestDia}
                </p>
              </div>
            </div>
            <p className="mt-4 flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-700">
              <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              Sin alertas ni síntomas recientes
            </p>
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
            <div className="mt-4 flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                {patient.contact.name
                  .split(' ')
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
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
            <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700">
              {patient.contact.phone}
            </p>
            <a
              href={`tel:${patient.contact.phone.replace(/\s/g, '')}`}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
            >
              <Phone className="size-4" aria-hidden="true" />
              Llamar ahora
            </a>
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

      <RegisterDeviceModal
        open={deviceModalOpen}
        onClose={() => setDeviceModalOpen(false)}
        onRegistered={() => {
          setDeviceModalOpen(false)
          showToast('Dispositivo Wear OS vinculado correctamente.')
        }}
      />

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

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  )
}