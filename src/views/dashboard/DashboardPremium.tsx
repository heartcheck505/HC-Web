import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Activity,
  ArrowUpRight,
  Battery,
  Bell,
  Cable,
  CalendarDays,
  CheckCircle2,
  Clock,
  Cross,
  Droplets,
  FileText,
  Gauge,
  Heart,
  ListFilter,
  MessageCircle,
  Moon,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Watch,
  Wifi,
  X,
} from 'lucide-react'
import {
  API_ENDPOINTS,
  apiClient,
  getStoredUser,
  isAuthenticated,
} from '../../api/apiClient'
import Sidebar from '../../components/layout/Sidebar'
import RegisterDeviceModal from '../../components/devices/RegisterDeviceModal'
import type { Alert, AlertSeverity, AlertStatus, AlertType } from '../../types/alert.types'
import type { Device } from '../../types/device.types'
import type { Measurement } from '../../types/measurement.types'
import type { Patient, PagedResult } from '../../types/patient.types'

function getFirstName(name: string | null | undefined): string {
  if (!name) {
    return ''
  }
  return name.trim().split(' ')[0] ?? ''
}

type Tone = 'none' | 'good' | 'info' | 'warn' | 'bad'

const toneStyles: Record<Tone, string> = {
  none: 'bg-slate-100 text-slate-600',
  good: 'bg-emerald-100 text-emerald-700',
  info: 'bg-sky-100 text-sky-700',
  warn: 'bg-amber-100 text-amber-700',
  bad: 'bg-rose-100 text-rose-700',
}

function StatusBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${toneStyles[tone]}`}
    >
      {children}
    </span>
  )
}

function heartRateTone(rate: number): Tone {
  if (rate === 0) {
    return 'none'
  }
  if (rate < 55 || rate > 140) {
    return 'bad'
  }
  if (rate < 60 || rate > 100) {
    return 'warn'
  }
  return 'good'
}

function heartRateLabel(rate: number): string {
  if (rate === 0) {
    return 'Sin datos'
  }
  if (rate < 55) {
    return 'Baja'
  }
  if (rate < 60) {
    return 'Lenta'
  }
  if (rate <= 100) {
    return 'Normal'
  }
  if (rate <= 140) {
    return 'Elevada'
  }
  return 'Crítica'
}

function spo2Tone(level: number): Tone {
  if (level === 0) {
    return 'none'
  }
  if (level >= 95) {
    return 'good'
  }
  if (level >= 90) {
    return 'warn'
  }
  return 'bad'
}

function spo2Label(level: number): string {
  if (level === 0) {
    return 'Sin datos'
  }
  if (level >= 95) {
    return 'Normal'
  }
  if (level >= 90) {
    return 'Baja'
  }
  return 'Crítica'
}

function hrvTone(milliseconds: number): Tone {
  if (milliseconds === 0) {
    return 'none'
  }
  if (milliseconds < 30) {
    return 'warn'
  }
  if (milliseconds <= 60) {
    return 'good'
  }
  return 'info'
}

function hrvLabel(milliseconds: number): string {
  if (milliseconds === 0) {
    return 'Sin datos'
  }
  if (milliseconds < 30) {
    return 'Baja variabilidad'
  }
  if (milliseconds <= 60) {
    return 'Variabilidad estable'
  }
  return 'Alta variabilidad'
}

function sleepTone(score: number): Tone {
  if (score === 0) {
    return 'none'
  }
  if (score >= 70) {
    return 'good'
  }
  return 'warn'
}

function sleepLabel(score: number): string {
  if (score === 0) {
    return 'Sin datos'
  }
  if (score >= 85) {
    return 'Excelente'
  }
  if (score >= 70) {
    return 'Buena calidad'
  }
  return 'A mejorar'
}

const alertTypeLabels: Record<AlertType, string> = {
  Tachycardia: 'Taquicardia',
  Bradycardia: 'Bradicardia',
  AtrialFibrillation: 'Fibrilación auricular',
  Hypoxia: 'Hipoxia',
  Hypertension: 'Hipertensión',
  Hypotension: 'Hipotensión',
  DeviceDisconnection: 'Desconexión de dispositivo',
  LowBattery: 'Batería baja',
}

const severityFilters: { value: 'Todos' | AlertSeverity; label: string }[] = [
  { value: 'Todos', label: 'Todas las gravedades' },
  { value: 'Critical', label: 'Crítico' },
  { value: 'Warning', label: 'Advertencia' },
  { value: 'Info', label: 'Informativo' },
]

const dayRanges: { value: '7' | '30' | '90'; label: string }[] = [
  { value: '7', label: 'Últimos 7 días' },
  { value: '30', label: 'Últimos 30 días' },
  { value: '90', label: 'Últimos 90 días' },
]

const eventStatusStyles: Record<AlertStatus, { badge: string; label: string }> = {
  Active: { badge: 'bg-rose-100 text-rose-700', label: 'Activo' },
  Acknowledged: { badge: 'bg-sky-100 text-sky-700', label: 'Confirmado' },
  Resolved: { badge: 'bg-emerald-100 text-emerald-700', label: 'Resuelto' },
}

const sleepPhaseLabels = ['Despierto', 'Ligero', 'Profundo', 'REM']

// Patrón visual de onda derivado de la frecuencia cardíaca; no son datos fijos.
const wavePattern = [30, 52, 42, 70, 48, 84, 58, 92, 50, 74, 44, 64, 36, 58, 30, 46]

function formatEventTime(iso: string): string {
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

function formatFullTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }
  return date.toLocaleString('es-ES', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const selectClass =
  'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20'

export default function DashboardPremium() {
  const toastTimer = useRef<number | null>(null)

  const currentUser = getStoredUser()

  const [userFirstName] = useState<string>(() =>
    getFirstName(`${currentUser?.firstName ?? ''} ${currentUser?.lastName ?? ''}`) ||
    getFirstName(currentUser?.firstName) ||
    'Cuidador',
  )
  const [patientName, setPatientName] = useState<string>('Paciente')

  // Indicadores clave: parten en 0 / vacíos / desconectados hasta recibir
  // telemetría real de la API o del reloj.
  const [device, setDevice] = useState<Device | null>(null)
  const [latestMeasurement, setLatestMeasurement] = useState<Measurement | null>(null)
  const [hrv, setHrv] = useState<number>(0)
  const [sleepScore, setSleepScore] = useState<number>(0)
  const [sleepTimeMinutes, setSleepTimeMinutes] = useState<number>(0)
  const [sleepPhases, setSleepPhases] = useState<number[]>([])
  const [stabilityScore, setStabilityScore] = useState<number | null>(null)
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null)
  const [events, setEvents] = useState<Alert[]>([])
  const [refreshKey, setRefreshKey] = useState(0)

  const [severityFilter, setSeverityFilter] = useState<
    'Todos' | AlertSeverity
  >('Todos')
  const [dayRange, setDayRange] = useState<'7' | '30' | '90'>('30')

  const [deviceModalOpen, setDeviceModalOpen] = useState(false)
  const [detailEvent, setDetailEvent] = useState<Alert | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (message: string): void => {
    if (toastTimer.current !== null) {
      window.clearTimeout(toastTimer.current)
    }
    setToast(message)
    toastTimer.current = window.setTimeout(() => {
      setToast(null)
      toastTimer.current = null
    }, 3000)
  }

  useEffect(() => {
    if (!isAuthenticated()) {
      return
    }
    let cancelled = false
    apiClient
      .get<Patient>(API_ENDPOINTS.patients.me)
      .then((profile) => {
        if (cancelled) {
          return
        }
        const fullName = `${profile.firstName} ${profile.lastName}`.trim()
        if (fullName) {
          setPatientName(fullName)
        }
      })
      .catch(() => {
        return
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated()) {
      return
    }
    let cancelled = false
    const toArray = <T,>(payload: T[] | PagedResult<T>): T[] =>
      Array.isArray(payload) ? payload : payload.items

    Promise.allSettled([
      apiClient.get<Device[] | PagedResult<Device>>(
        `${API_ENDPOINTS.devices.list}?page=1&pageSize=1`,
      ),
      apiClient.get<Measurement[] | PagedResult<Measurement>>(
        `${API_ENDPOINTS.measurements.list}?page=1&pageSize=1`,
      ),
      apiClient.get<Alert[] | PagedResult<Alert>>(
        `${API_ENDPOINTS.alerts.list}?pageSize=30`,
      ),
    ])
      .then(([deviceResult, measurementResult, alertsResult]) => {
        if (cancelled) {
          return
        }
        if (deviceResult.status === 'fulfilled') {
          setDevice(toArray(deviceResult.value)[0] ?? null)
        }
        if (measurementResult.status === 'fulfilled') {
          const latest = toArray(measurementResult.value)[0] ?? null
          setLatestMeasurement(latest)
          // VFC y sueño: el backend aún no los expone; se mantienen en espera
          // (0 / vacíos) hasta que la API o el reloj los reporte.
          setHrv(0)
          setSleepScore(0)
          setSleepTimeMinutes(0)
          setSleepPhases([])
        }
        if (alertsResult.status === 'fulfilled') {
          setEvents(toArray(alertsResult.value))
        }
        // Puntaje de estabilidad y análisis predictivo: el backend aún no los
        // expone; permanecen en espera ('--') hasta disponer del servicio.
        setStabilityScore(null)
        setAiAnalysis(null)
      })
      .catch(() => {
        return
      })
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  const filteredEvents = useMemo<Alert[]>(() => {
    const cutoff =
      Date.now() - Number(dayRange) * 24 * 60 * 60 * 1000
    return events
      .filter(
        (event) =>
          severityFilter === 'Todos' || event.severity === severityFilter,
      )
      .filter((event) => new Date(event.createdAt).getTime() >= cutoff)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
  }, [events, severityFilter, dayRange])

  const heartRate = latestMeasurement?.heartRate ?? 0
  const spo2 = latestMeasurement?.spo2 ?? 0
  const waveBars =
    heartRate > 0
      ? wavePattern.map((height) =>
          Math.max(8, Math.round(height * (heartRate / 80))),
        )
      : []

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
              placeholder="Buscar paciente o evento..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </label>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setRefreshKey((value) => value + 1)
                showToast('Datos actualizados con la última sincronización.')
              }}
              aria-label="Actualizar datos"
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Actualizar
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

        <section className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-blue-950 sm:text-3xl">
                Hola {userFirstName}, monitoreando{' '}
                <span className="text-blue-600">{patientName}</span>
              </h1>
              <span className="flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
                <Star className="size-3.5 fill-current" aria-hidden="true" />
                Plan Premium
              </span>
            </div>
            <p className="mt-2 flex items-center gap-2 text-sm text-slate-600">
              <span className="size-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
              Panel Premium · Análisis avanzado habilitado
            </p>
          </div>
        </section>

        {/* Fila 1: Predicciones IA & Acciones Gold */}
        <section className="mt-8 grid gap-6 xl:grid-cols-3" aria-label="Predicciones y acciones">
          <div className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
            <span className="absolute right-5 top-5 flex items-center gap-1.5 rounded-full bg-blue-600 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm">
              <Gauge className="size-3.5" aria-hidden="true" />
              Puntaje de estabilidad:{' '}
              {stabilityScore === null ? '--' : stabilityScore}/100
            </span>

            <h2 className="text-lg font-bold text-slate-900">
              Predicciones mediante IA
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Basado en actividad multimodal
            </p>

            <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-5">
              {aiAnalysis ? (
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-600">
                    <Sparkles className="size-4 text-white" aria-hidden="true" />
                  </span>
                  <p className="text-sm leading-relaxed text-blue-950">
                    {aiAnalysis}
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-600/10">
                    <Sparkles className="size-4 text-blue-600" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-blue-900">
                      Análisis Predictivo en espera
                    </p>
                    <p className="text-xs text-blue-700/80">
                      Conecta tu dispositivo y espera la siguiente
                      sincronización para generar la predicción.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-blue-800 to-blue-950 p-6 text-white shadow-lg">
            <div className="flex items-center gap-2">
              <Star className="size-5 fill-amber-300 text-amber-300" aria-hidden="true" />
              <h2 className="text-lg font-bold">Acciones Gold</h2>
            </div>
            <p className="mt-1 text-sm text-blue-200">
              Beneficios exclusivos del plan premium.
            </p>
            <div className="mt-5 space-y-3">
              <button
                type="button"
                onClick={() =>
                  showToast(
                    'La exportación de reportes clínicos estará disponible en breve.',
                  )
                }
                className="flex w-full items-center gap-3 rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/20"
              >
                <FileText className="size-5 shrink-0 text-amber-300" aria-hidden="true" />
                <span className="flex-1 text-left">
                  Todos los reportes Clínica
                </span>
                <ArrowUpRight className="size-4 shrink-0 text-blue-200" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => {
                  document
                    .getElementById('eventos-clinicos')
                    ?.scrollIntoView({ behavior: 'smooth' })
                }}
                className="flex w-full items-center gap-3 rounded-xl bg-amber-400/90 px-4 py-3 text-sm font-bold text-blue-950 transition-colors hover:bg-amber-400"
              >
                <Cross className="size-5 shrink-0" aria-hidden="true" />
                <span className="flex-1 text-left">
                  Alertas Preventivas y Prioritarias
                </span>
                <ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>

        {/* Fila 2: Tarjetas de Métricas Clave */}
        <section className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4" aria-label="Métricas clave">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Frecuencia Cardíaca
              </p>
              <span className="flex size-9 items-center justify-center rounded-full bg-red-100">
                <Heart className="size-5 text-red-500" aria-hidden="true" />
              </span>
            </div>
            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="text-5xl font-extrabold text-slate-900">
                {heartRate > 0 ? heartRate : '--'}
              </span>
              <span className="text-lg font-semibold text-slate-500">BPM</span>
            </div>
            <div className="mt-3">
              <StatusBadge tone={heartRateTone(heartRate)}>
                {heartRateLabel(heartRate)}
              </StatusBadge>
            </div>
            {waveBars.length > 0 ? (
              <div
                className="mt-5 flex h-16 items-end gap-1"
                aria-label="Onda de frecuencia cardíaca"
              >
                {waveBars.map((height, index) => (
                  <span
                    key={`${index}-${height}`}
                    className="flex-1 rounded-t bg-blue-500/70 transition-[height] duration-500"
                    style={{ height: `${height}%` }}
                    aria-hidden="true"
                  />
                ))}
              </div>
            ) : (
              <div className="mt-5 flex h-16 items-center justify-center rounded-lg bg-slate-50 text-xs text-slate-400">
                Esperando señal del reloj…
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Saturación SpO₂
              </p>
              <span className="flex size-9 items-center justify-center rounded-full bg-sky-100">
                <Droplets className="size-5 text-sky-600" aria-hidden="true" />
              </span>
            </div>
            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="text-5xl font-extrabold text-slate-900">
                {spo2 > 0 ? spo2 : '--'}
              </span>
              <span className="text-lg font-semibold text-slate-500">%</span>
            </div>
            <div className="mt-3">
              <StatusBadge tone={spo2Tone(spo2)}>{spo2Label(spo2)}</StatusBadge>
            </div>
            <div className="mt-5">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Oxigenación</span>
                <span>{spo2 > 0 ? `${spo2}%` : '—'}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-sky-500 transition-[width] duration-500"
                  style={{ width: spo2 > 0 ? `${Math.min(100, spo2)}%` : '0%' }}
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                VFC · Variabilidad
              </p>
              <span className="flex size-9 items-center justify-center rounded-full bg-blue-100">
                <Activity className="size-5 text-blue-600" aria-hidden="true" />
              </span>
            </div>
            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="text-5xl font-extrabold text-slate-900">
                {hrv > 0 ? hrv : '--'}
              </span>
              <span className="text-lg font-semibold text-slate-500">ms</span>
            </div>
            <div className="mt-3">
              <StatusBadge tone={hrvTone(hrv)}>{hrvLabel(hrv)}</StatusBadge>
            </div>
            <p className="mt-5 text-sm leading-relaxed text-slate-500">
              {hrv > 0
                ? 'Mayor variabilidad indica mejor recuperación y menor estrés.'
                : 'Conecta el reloj para disponer de este indicador.'}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Calidad de Sueño
              </p>
              <span className="flex size-9 items-center justify-center rounded-full bg-violet-100">
                <Moon className="size-5 text-violet-600" aria-hidden="true" />
              </span>
            </div>
            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="text-5xl font-extrabold text-slate-900">
                {sleepScore > 0 ? sleepScore : '--'}
              </span>
              <span className="text-lg font-semibold text-slate-500">
                /100
              </span>
            </div>
            <div className="mt-3">
              <StatusBadge tone={sleepTone(sleepScore)}>
                {sleepLabel(sleepScore)}
              </StatusBadge>
            </div>
            <p className="mt-4 text-sm text-slate-500">
              {sleepTimeMinutes > 0
                ? `Duración: ${Math.floor(sleepTimeMinutes / 60)} h ${
                    sleepTimeMinutes % 60
                  } min`
                : 'Duración: —'}
            </p>
            {sleepPhases.length > 0 ? (
              <div className="mt-3 flex h-14 items-end gap-1.5" aria-label="Fases de sueño">
                {sleepPhases.map((phase, index) => (
                  <div
                    key={sleepPhaseLabels[index] ?? index}
                    className="flex-1"
                    aria-hidden="true"
                  >
                    <div
                      className="rounded-t bg-violet-500/70 transition-[height] duration-500"
                      style={{
                        height: `${Math.min(100, Math.max(0, phase))}%`,
                      }}
                    />
                    <p className="mt-1 truncate text-center text-[9px] text-slate-400">
                      {sleepPhaseLabels[index] ?? ''}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 flex h-14 items-center justify-center rounded-lg bg-slate-50 text-xs text-slate-400">
                Esperando fases de sueño del reloj…
              </div>
            )}
          </div>
        </section>

        {/* Fila 3: Eventos Clínicos Recientes & Dispositivos */}
        <section className="mt-8 grid gap-6 xl:grid-cols-3">
          <div
            id="eventos-clinicos"
            className="scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Eventos Clínicos Recientes
                </h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  Alertas registradas por el sistema de monitoreo.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-sm text-slate-600">
                  <ListFilter className="size-4 text-slate-400" aria-hidden="true" />
                  <select
                    value={severityFilter}
                    onChange={(event) =>
                      setSeverityFilter(
                        event.target.value as 'Todos' | AlertSeverity,
                      )
                    }
                    className={selectClass}
                    aria-label="Filtrar por gravedad"
                  >
                    {severityFilters.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-1.5 text-sm text-slate-600">
                  <CalendarDays className="size-4 text-slate-400" aria-hidden="true" />
                  <select
                    value={dayRange}
                    onChange={(event) =>
                      setDayRange(event.target.value as '7' | '30' | '90')
                    }
                    className={selectClass}
                    aria-label="Rango de días"
                  >
                    {dayRanges.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {filteredEvents.length === 0 ? (
              <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-white shadow-sm">
                  <CheckCircle2 className="size-6 text-slate-400" aria-hidden="true" />
                </span>
                <p className="mt-3 font-semibold text-slate-700">
                  No hay eventos clínicos registrados
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  No se encontraron eventos en el rango y gravedad
                  seleccionados.
                </p>
              </div>
            ) : (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[560px] divide-y divide-slate-200 text-left text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                      <th className="px-4 py-3 font-semibold">Evento</th>
                      <th className="px-4 py-3 font-semibold">Estado</th>
                      <th className="px-4 py-3 font-semibold">Hora</th>
                      <th className="px-4 py-3 text-right font-semibold">
                        Acción
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredEvents.map((event) => {
                      const statusStyle = eventStatusStyles[event.status]
                      return (
                        <tr key={event.id} className="transition-colors hover:bg-slate-50/60">
                          <td className="px-4 py-3.5">
                            <p className="font-medium text-slate-900">
                              {alertTypeLabels[event.type] ?? event.type}
                            </p>
                            <p className="truncate text-slate-500">
                              {event.message}
                            </p>
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyle.badge}`}
                            >
                              {statusStyle.label}
                            </span>
                          </td>
                          <td className="whitespace-nowrap text-slate-600">
                            {formatEventTime(event.createdAt)}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => setDetailEvent(event)}
                              className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100"
                            >
                              Ver detalle
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                Dispositivos Vinculados
              </h2>
              <button
                type="button"
                onClick={() => setDeviceModalOpen(true)}
                className="flex items-center gap-1 text-sm font-semibold text-blue-600 transition-colors hover:underline"
              >
                Administrar
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </button>
            </div>

            {device ? (
              <div className="mt-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-50">
                      <Watch className="size-6 text-blue-600" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">
                        {device.model}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {device.serialNumber}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      device.lastSyncAt
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <span
                      className={`size-1.5 rounded-full ${
                        device.lastSyncAt ? 'bg-emerald-500' : 'bg-slate-400'
                      }`}
                      aria-hidden="true"
                    />
                    {device.lastSyncAt ? 'Conectado' : 'Desconectado'}
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-slate-600">
                      <Battery className="size-4" aria-hidden="true" />
                      Batería
                    </span>
                    <span className="font-semibold text-slate-700">
                      {device.batteryLevel}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-[width] duration-500"
                      style={{ width: `${Math.min(100, Math.max(0, device.batteryLevel))}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2.5 text-sm text-slate-600">
                  {device.lastSyncAt ? (
                    <Wifi className="size-4 shrink-0 text-emerald-500" aria-hidden="true" />
                  ) : (
                    <Cable className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
                  )}
                  <span>
                    Última sincronización:{' '}
                    {device.lastSyncAt ? formatEventTime(device.lastSyncAt) : '—'}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 text-sm text-slate-600">
                  <Clock className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
                  <span>
                    {device.status === 'Active'
                      ? 'Telemetría activa y enviando datos.'
                      : 'Dispositivo registrado, pendiente de activación.'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-white shadow-sm">
                  <Watch className="size-6 text-slate-400" aria-hidden="true" />
                </span>
                <p className="mt-3 font-semibold text-slate-700">
                  Sin dispositivo vinculado
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Vincula tu reloj inteligente para comenzar a recibir
                  telemetría en tiempo real.
                </p>
                <button
                  type="button"
                  onClick={() => setDeviceModalOpen(true)}
                  className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                >
                  Vincular ahora
                </button>
              </div>
            )}
          </div>
        </section>
      </main>

      <RegisterDeviceModal
        open={deviceModalOpen}
        onClose={() => setDeviceModalOpen(false)}
        onRegistered={() => {
          setDeviceModalOpen(false)
          setRefreshKey((value) => value + 1)
          showToast('Dispositivo Wear OS vinculado correctamente.')
        }}
      />

      {detailEvent && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="event-detail-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          onClick={() => setDetailEvent(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-blue-100">
                  <Activity className="size-5 text-blue-600" aria-hidden="true" />
                </span>
                <div>
                  <h2
                    id="event-detail-title"
                    className="text-lg font-bold text-slate-900"
                  >
                    {alertTypeLabels[detailEvent.type] ?? detailEvent.type}
                  </h2>
                  <p className="text-xs uppercase tracking-wide text-slate-400">
                    Detalle del evento clínico
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailEvent(null)}
                aria-label="Cerrar"
                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
              {detailEvent.message}
            </p>

            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Gravedad</dt>
                <dd>
                  <StatusBadge
                    tone={
                      detailEvent.severity === 'Critical'
                        ? 'bad'
                        : detailEvent.severity === 'Warning'
                          ? 'warn'
                          : 'info'
                    }
                  >
                    {severityFilters.find(
                      (option) => option.value === detailEvent.severity,
                    )?.label ?? detailEvent.severity}
                  </StatusBadge>
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Estado</dt>
                <dd>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      eventStatusStyles[detailEvent.status].badge
                    }`}
                  >
                    {eventStatusStyles[detailEvent.status].label}
                  </span>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="shrink-0 text-slate-500">Momento</dt>
                <dd className="text-right font-medium capitalize text-slate-800">
                  {formatFullTime(detailEvent.createdAt)}
                </dd>
              </div>
            </dl>

            <button
              type="button"
              onClick={() => setDetailEvent(null)}
              className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              Cerrar
            </button>
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