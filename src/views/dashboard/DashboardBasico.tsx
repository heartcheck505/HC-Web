import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Bell,
  ChevronRight,
  ClipboardList,
  Heart,
  Lock,
  MessageCircle,
  Phone,
  Plus,
  Search,
  Star,
  X,
} from 'lucide-react'
import {
  API_ENDPOINTS,
  apiClient,
  getMeasurements,
  getPatientMe,
  getStoredEmergencyContact,
  getStoredPatientDisplayName,
  getStoredUser,
  isAuthenticated,
  normalizePhoneForTel,
  setStoredPatient,
  setUserPlan,
} from '../../api/apiClient'
import Sidebar from '../../components/layout/Sidebar'
import PlanChangeModal from '../../components/plan/PlanChangeModal'
import HeartRateTrendChart from '../../components/charts/HeartRateTrendChart'
import RiskAssessmentCard from '../../components/risk/RiskAssessmentCard'
import {
  formatTimeLabel,
  limitLatestReadings,
  normalLabel,
} from '../../components/charts/historyLimit'
import type { MeasurementReading } from '../../types/measurement.types'
import type { PagedResult } from '../../types/patient.types'

function getFirstName(name: string | null | undefined): string {
  if (!name) {
    return ''
  }
  return name.trim().split(' ')[0] ?? ''
}

interface LogRowProps {
  day: number
  text: string
  emoji: string
  tone: 'gray' | 'amber'
}

function LogRow({ day, text, emoji, tone }: LogRowProps) {
  return (
    <div
      className={`flex items-center gap-4 rounded-xl border p-4 ${
        tone === 'gray'
          ? 'border-slate-200 bg-slate-50'
          : 'border-amber-200 bg-amber-50/70'
      }`}
    >
      <span
        className={`flex size-12 shrink-0 items-center justify-center rounded-xl text-lg font-bold ${
          tone === 'gray' ? 'bg-white text-slate-700' : 'bg-white text-slate-700'
        }`}
      >
        {day}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-700">{text}</p>
      </div>
      <span className="shrink-0 text-2xl" role="img" aria-label="Estado del día">
        {emoji}
      </span>
    </div>
  )
}

type TrendPeriod = 'day' | 'week' | 'month'

const TREND_RANGES: Record<TrendPeriod, number> = {
  day: 1,
  week: 7,
  month: 30,
}

const TREND_OPTIONS: { value: TrendPeriod; label: string }[] = [
  { value: 'day', label: 'Día' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
]

export default function DashboardBasico() {
  const toastTimer = useRef<number | null>(null)
  const location = useLocation()
  const navigate = useNavigate()

  const currentUser = getStoredUser()

  const [caregiverFirstName] = useState<string>(() =>
    getFirstName(`${currentUser?.firstName ?? ''} ${currentUser?.lastName ?? ''}`) ||
    getFirstName(currentUser?.firstName) ||
    'Cuidador',
  )
  const [patientName, setPatientName] = useState<string>(
    () => getStoredPatientDisplayName(),
  )
  // Contacto de emergencia persistido en la sesión/respaldo (paciente primero,
  // perfil del cuidador del registro como alternativa).
  const emergencyContact = getStoredEmergencyContact()
  const emergencyTel = normalizePhoneForTel(emergencyContact.phone)
  const hasEmergencyContact = Boolean(
    emergencyContact.name.trim() || emergencyContact.phone.trim(),
  )
  const [latestMeasurement, setLatestMeasurement] =
    useState<MeasurementReading | null>(null)
  const [inicioReadings, setInicioReadings] = useState<MeasurementReading[]>([])
  const [trendReadings, setTrendReadings] = useState<MeasurementReading[]>([])
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>('day')

  useEffect(() => {
    if (!isAuthenticated()) {
      return
    }
    let cancelled = false
    getPatientMe()
      .then((profile) => {
        if (cancelled) {
          return
        }
        const fullName = `${profile.firstName} ${profile.lastName}`.trim()
        if (fullName) {
          setPatientName(fullName)
          // Persiste en la sesión para no perder el nombre al navegar.
          setStoredPatient({
            firstName: profile.firstName,
            lastName: profile.lastName,
            emergencyContactName: profile.emergencyContactName ?? null,
            emergencyContactPhone: profile.emergencyContactPhone ?? null,
          })
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
      apiClient.get<MeasurementReading[] | PagedResult<MeasurementReading>>(
        `${API_ENDPOINTS.measurements.list}?page=1&pageSize=1`,
      ),
      getMeasurements(),
    ]).then(([measurementResult, readingsResult]) => {
      if (cancelled) {
        return
      }
      if (measurementResult.status === 'fulfilled') {
        setLatestMeasurement(toArray(measurementResult.value)[0] ?? null)
      }
      if (readingsResult.status === 'fulfilled') {
        // Lecturas reales de GET /api/measurements para la gráfica de Inicio.
        setInicioReadings(readingsResult.value)
      }
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
    const days = TREND_RANGES[trendPeriod]
    const to = new Date().toISOString()
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    // Consulta de Tendencias con parámetros ?from=&to= de la API exacta.
    getMeasurements(from, to)
      .then((readings) => {
        if (!cancelled) {
          setTrendReadings(readings)
        }
      })
      .catch(() => {
        return
      })
    return () => {
      cancelled = true
    }
  }, [trendPeriod])

  const latestBpm = latestMeasurement?.bpm ?? 0
  const latestLabel = normalLabel(latestMeasurement?.isNormal)
  const recentReadings = useMemo(
    () => limitLatestReadings(trendReadings, 5),
    [trendReadings],
  )

  const [emergencyOpen, setEmergencyOpen] = useState(false)
  const [symptomOpen, setSymptomOpen] = useState(false)
  const [upgradeOpen, setUpgradeOpen] = useState<boolean>(() => {
    const state = location.state as { upgradeRequired?: boolean } | null
    return Boolean(state?.upgradeRequired)
  })
  const [upgradeFlowOpen, setUpgradeFlowOpen] = useState(false)
  const [symptomName, setSymptomName] = useState('')
  const [symptomIntensity, setSymptomIntensity] = useState('Leve')
  const [symptomNotes, setSymptomNotes] = useState('')
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

  const handleSymptomSubmit = (): void => {
    setSymptomOpen(false)
    setSymptomName('')
    setSymptomIntensity('Leve')
    setSymptomNotes('')
    showToast('Síntoma registrado correctamente.')
  }

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

        <section className="mt-8 flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-blue-950">
              Hola {caregiverFirstName}, monitoreando{' '}
              <span className="text-blue-600">{patientName}</span>
            </h1>
            <p className="mt-2 flex items-center gap-2 text-sm text-slate-600">
              <span className="size-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
              Estatus Estable
              <span className="text-slate-400">• Sin telemetría disponible</span>
            </p>
          </div>

          <Link
            to="/planes"
            className="group relative max-w-md rounded-2xl bg-blue-600 p-6 pr-16 text-white shadow-lg transition-colors hover:bg-blue-700"
          >
            <span className="absolute -top-3 left-6 flex size-10 items-center justify-center rounded-full bg-white text-blue-600 shadow-md">
              <Star className="size-5 fill-current" aria-hidden="true" />
            </span>
            <p className="font-bold">Plan básico activo</p>
            <p className="mt-1 text-sm text-blue-100 group-hover:underline">
              Mejora a Premium para análisis avanzados →
            </p>
          </Link>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-2" aria-label="Métricas">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Frecuencia Cardiaca Reciente
              </p>
              <span className="flex size-9 items-center justify-center rounded-full bg-red-100">
                <Heart className="size-5 text-red-500" aria-hidden="true" />
              </span>
            </div>
            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="text-5xl font-extrabold text-slate-900">
                {latestMeasurement?.bpm ?? 0}
              </span>
              <span className="text-lg font-semibold text-slate-500">BPM</span>
            </div>
            <p className="mt-4 text-sm text-slate-500">
              {latestMeasurement
                ? 'Última lectura recibida del monitor.'
                : 'Sin telemetría disponible todavía.'}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Alertas
            </p>
            <p className="mt-4 text-sm text-slate-500">No hay alertas activas.</p>
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <div className="rounded-2xl bg-blue-800 p-6 text-white shadow-lg">
              <div className="flex items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/10">
                  <ClipboardList className="size-6" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-base font-bold">Registro de Síntomas</p>
                  <p className="text-sm text-blue-200">
                    Registre manualmente cualquier mareo o molestia.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSymptomOpen(true)}
                className="mt-5 flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50"
              >
                <Plus className="size-4" aria-hidden="true" />
                Nuevo Registro
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">
                  Bitácora: Últimos 30 días
                </h3>
                <button
                  type="button"
                  className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
                >
                  Ver registro detallado
                  <ChevronRight className="size-4" aria-hidden="true" />
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <LogRow
                  day={24}
                  tone="gray"
                  emoji="😊"
                  text="Sin datos clínicos recientes."
                />
                <LogRow
                  day={23}
                  tone="amber"
                  emoji="😐"
                  text="Sin telemetría disponible en el período."
                />
              </div>

              <div className="relative mt-4">
                <div className="pointer-events-none space-y-3 select-none blur-[1.5px]" aria-hidden="true">
                  <LogRow
                    day={22}
                    tone="gray"
                    text="Sin datos disponibles"
                    emoji="😊"
                  />
                  <LogRow
                    day={21}
                    tone="gray"
                    text="Sin datos disponibles"
                    emoji="😊"
                  />
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-white/70 p-4 text-center">
                  <span className="flex size-12 items-center justify-center rounded-full bg-slate-200">
                    <Lock className="size-6 text-slate-600" aria-hidden="true" />
                  </span>
                  <p className="font-semibold text-slate-800">
                    Análisis de tendencias bloqueado
                  </p>
                  <p className="max-w-xs text-sm text-slate-500">
                    Actualice a Premium para visualizar las tendencias de salud
                    mensuales.
                  </p>
                  <Link
                    to="/planes"
                    className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                  >
                    Mejorar plan
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Gráfica de Inicio: últimas 10 lecturas reales de GET /api/measurements */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Ritmo cardíaco · Últimas 10 lecturas
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Lecturas recientes del dispositivo.
                </p>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-extrabold text-slate-900">
                  {latestBpm > 0 ? latestBpm : '--'}
                </span>
                <span className="text-base font-semibold text-slate-500">
                  BPM
                </span>
              </div>
            </div>

            <div className="mt-3">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                  latestLabel === 'Alto'
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                <span
                  className={`size-1.5 rounded-full ${
                    latestLabel === 'Alto'
                      ? 'bg-rose-500'
                      : 'bg-emerald-500'
                  }`}
                  aria-hidden="true"
                />
                {latestLabel}
              </span>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-4">
              <HeartRateTrendChart items={inicioReadings} />
            </div>
          </div>

          {/* Tendencias: selector de período + gráfica + registros recientes */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Tendencias</h3>
                <p className="mt-0.5 text-sm text-slate-500">
                  Ritmo cardíaco / Registros recientes
                </p>
              </div>
              <div
                role="group"
                aria-label="Período de tendencias"
                className="flex w-fit rounded-lg border border-slate-200 bg-slate-50 p-0.5"
              >
                {TREND_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTrendPeriod(option.value)}
                    aria-pressed={trendPeriod === option.value}
                    className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                      trendPeriod === option.value
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <RiskAssessmentCard locked />
            </div>

            <div className="mt-5 rounded-2xl border border-slate-100 bg-white p-4">
              <HeartRateTrendChart items={trendReadings} />
            </div>

            <h4 className="mt-6 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Registros recientes
            </h4>
            {recentReadings.length === 0 ? (
              <p className="mt-3 rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
                Sin registros en el período seleccionado.
              </p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {recentReadings.map((reading, index) => {
                  const label = normalLabel(reading.isNormal)
                  return (
                    <li
                      key={`${reading.timestamp}-${reading.bpm}-${index}`}
                      className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3"
                    >
                      <span className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl bg-white font-extrabold text-slate-900 shadow-sm">
                        {reading.bpm}
                        <span className="text-[9px] font-semibold uppercase text-slate-400">
                          BPM
                        </span>
                      </span>
                      <p className="min-w-0 flex-1 text-sm font-medium text-slate-600">
                        {formatTimeLabel(reading.timestamp)}
                      </p>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                          label === 'Alto'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {label}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
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
              para {patientName}.
            </p>
            {hasEmergencyContact && emergencyTel && (
              <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                <p className="font-semibold text-slate-900">
                  {emergencyContact.name || 'Contacto de emergencia'}
                </p>
                <a
                  href={`tel:${emergencyTel}`}
                  className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:underline"
                >
                  <Phone className="size-4" aria-hidden="true" />
                  {emergencyContact.phone}
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
                onClick={() => {
                  setEmergencyOpen(false)
                  showToast('Servicio de emergencia notificado.')
                }}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-700"
              >
                Llama ahora
              </button>
            </div>
          </div>
        </div>
      )}

      {symptomOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="symptom-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          onClick={() => setSymptomOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 id="symptom-title" className="text-lg font-bold text-slate-900">
                  Nuevo Registro de Síntoma
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Describe la molestia para el seguimiento de {patientName}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSymptomOpen(false)}
                aria-label="Cerrar"
                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            <form
              className="mt-4 space-y-4"
              onSubmit={(event) => {
                event.preventDefault()
                handleSymptomSubmit()
              }}
            >
              <div>
                <label htmlFor="symptom-name" className="block text-sm font-medium text-slate-700">
                  Tipo de síntoma
                </label>
                <input
                  id="symptom-name"
                  type="text"
                  value={symptomName}
                  onChange={(event) => setSymptomName(event.target.value)}
                  placeholder="Ej. Mareo, dolor de cabeza..."
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>

              <div>
                <label htmlFor="symptom-intensity" className="block text-sm font-medium text-slate-700">
                  Intensidad
                </label>
                <select
                  id="symptom-intensity"
                  value={symptomIntensity}
                  onChange={(event) => setSymptomIntensity(event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
                >
                  <option>Leve</option>
                  <option>Moderada</option>
                  <option>Severa</option>
                </select>
              </div>

              <div>
                <label htmlFor="symptom-notes" className="block text-sm font-medium text-slate-700">
                  Notas adicionales
                </label>
                <textarea
                  id="symptom-notes"
                  value={symptomNotes}
                  onChange={(event) => setSymptomNotes(event.target.value)}
                  placeholder="Describe brevemente el malestar..."
                  rows={3}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                Guardar síntoma
              </button>
            </form>
          </div>
        </div>
      )}

      {upgradeOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="upgrade-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          onClick={() => setUpgradeOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <span className="flex size-12 items-center justify-center rounded-full bg-amber-100">
                <Star className="size-6 text-amber-600" aria-hidden="true" />
              </span>
              <button
                type="button"
                onClick={() => setUpgradeOpen(false)}
                aria-label="Cerrar"
                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <h2 id="upgrade-title" className="mt-4 text-lg font-bold text-slate-900">
              Dashboard Premium requerido
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Tu plan actual no incluye el panel Premium. Actualiza tu plan para
              acceder a predicciones con IA, métricas avanzadas y eventos
              clínicos.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setUpgradeOpen(false)}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Ahora no
              </button>
              <button
                type="button"
                onClick={() => {
                  setUpgradeOpen(false)
                  setUpgradeFlowOpen(true)
                }}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                Actualizar ahora
              </button>
            </div>
            <Link
              to="/planes"
              onClick={() => setUpgradeOpen(false)}
              className="mt-3 block text-center text-sm font-medium text-blue-600 hover:underline"
            >
              Ver todos los planes →
            </Link>
          </div>
        </div>
      )}

      <PlanChangeModal
        open={upgradeFlowOpen}
        mode="upgrade"
        planName="Premium"
        price="$19.99"
        onClose={() => setUpgradeFlowOpen(false)}
        onConfirmed={() => {
          setUserPlan('premium')
          setUpgradeFlowOpen(false)
          navigate('/dashboard-premium')
        }}
      />

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
