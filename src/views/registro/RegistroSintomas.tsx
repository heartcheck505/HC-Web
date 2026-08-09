import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  Bell,
  CalendarDays,
  ChevronRight,
  Filter,
  Lock,
  MessageCircle,
  Plus,
  Search,
  Star,
  User,
  X,
} from 'lucide-react'
import { API_ENDPOINTS, apiClient } from '../../api/apiClient'
import Sidebar from '../../components/layout/Sidebar'

const trendBars = [40, 65, 50, 75, 55, 80, 60, 70, 45, 68, 52, 74, 48, 72]

interface SymptomOption {
  value: string
  label: string
  emoji: string
}

const SYMPTOMS: SymptomOption[] = [
  { value: 'headache', label: 'Dolor de cabeza', emoji: '🤕' },
  { value: 'dizziness', label: 'Mareo', emoji: '🌀' },
  { value: 'fatigue', label: 'Fatiga', emoji: '⚡' },
  { value: 'palpitations', label: 'Palpitaciones', emoji: '💔' },
  { value: 'blurred-vision', label: 'Visión borrosa', emoji: '👁️' },
  { value: 'stress', label: 'Estrés', emoji: '😣' },
  { value: 'no-symptoms', label: 'Sin síntomas', emoji: '✓' },
]

const INTENSITY_LEVELS = ['Muy leve', 'Leve', 'Moderada', 'Alta', 'Crónica']

interface SymptomRecord {
  id: string
  emoji: string
  name: string
  timeLabel: string
}

interface SymptomEventPayload {
  type: 'symptom'
  patientId: string
  symptom: string
  intensity: string
  intensityLevel: number
  notes?: string
  recordedAt: string
}

interface PatientStatProps {
  label: string
  value: ReactNode
}

function PatientStat({ label, value }: PatientStatProps) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
        {value}
      </div>
    </div>
  )
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toTimeInputValue(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

function formatTimeLabel(date: Date): string {
  const hours = date.getHours()
  const hour12 = hours % 12 === 0 ? 12 : hours % 12
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const meridiem = hours >= 12 ? 'PM' : 'AM'
  return `${hour12}:${minutes} ${meridiem} - Hoy`
}

const LOCAL_SYMPTOMS_KEY = 'local_symptoms_history'

const DEFAULT_RECORDS: SymptomRecord[] = [
  { id: 'rec-1', emoji: '⚡', name: 'Fatiga leve', timeLabel: '10:30 AM - Hoy' },
  { id: 'rec-2', emoji: '✓', name: 'Sin síntomas', timeLabel: '08:00 AM - Hoy' },
  { id: 'rec-3', emoji: '💔', name: 'Palpitaciones', timeLabel: '21:15 PM - Ayer' },
]

function loadLocalRecords(): SymptomRecord[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_SYMPTOMS_KEY)
    if (!raw) {
      return []
    }
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.filter(
      (item): item is SymptomRecord =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as SymptomRecord).id === 'string' &&
        typeof (item as SymptomRecord).emoji === 'string' &&
        typeof (item as SymptomRecord).name === 'string' &&
        typeof (item as SymptomRecord).timeLabel === 'string',
    )
  } catch {
    return []
  }
}

function persistLocalRecords(records: SymptomRecord[]): void {
  try {
    window.localStorage.setItem(
      LOCAL_SYMPTOMS_KEY,
      JSON.stringify(records.slice(0, 50)),
    )
  } catch {
    return
  }
}

const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20'

export default function RegistroSintomas() {
  const toastTimer = useRef<number | null>(null)

  const [emergencyOpen, setEmergencyOpen] = useState(false)
  const [toast, setToast] = useState<{
    message: string
    tone: 'success' | 'error'
  } | null>(null)
  const [saving, setSaving] = useState(false)

  const [formDate, setFormDate] = useState(() => toDateInputValue(new Date()))
  const [formTime, setFormTime] = useState(() => toTimeInputValue(new Date()))
  const [symptom, setSymptom] = useState('')
  const [intensity, setIntensity] = useState(2)
  const [notes, setNotes] = useState('')

  const [records, setRecords] = useState<SymptomRecord[]>(() => [
    ...loadLocalRecords(),
    ...DEFAULT_RECORDS,
  ])

  const intensityLabel = INTENSITY_LEVELS[intensity - 1]

  const showToast = (
    message: string,
    tone: 'success' | 'error' = 'success',
  ): void => {
    if (toastTimer.current !== null) {
      window.clearTimeout(toastTimer.current)
    }
    setToast({ message, tone })
    toastTimer.current = window.setTimeout(() => {
      setToast(null)
      toastTimer.current = null
    }, 3500)
  }

  const resetForm = (): void => {
    const now = new Date()
    setFormDate(toDateInputValue(now))
    setFormTime(toTimeInputValue(now))
    setSymptom('')
    setIntensity(2)
    setNotes('')
  }

  const handleSubmit = async (): Promise<void> => {
    if (!symptom) {
      showToast('Selecciona un síntoma para continuar.', 'error')
      return
    }
    if (saving) {
      return
    }

    setSaving(true)
    const selected = SYMPTOMS.find((option) => option.value === symptom)
    const parsed = new Date(`${formDate}T${formTime}:00`)
    const timestamp = Number.isNaN(parsed.getTime()) ? new Date() : parsed

    const payload: SymptomEventPayload = {
      type: 'symptom',
      patientId: 'roberto-m',
      symptom: selected?.label ?? symptom,
      intensity: intensityLabel,
      intensityLevel: intensity,
      notes: notes.trim() || undefined,
      recordedAt: timestamp.toISOString(),
    }

    const record: SymptomRecord = {
      id: crypto.randomUUID(),
      emoji: selected?.emoji ?? '📝',
      name:
        selected?.value === 'no-symptoms'
          ? 'Sin síntomas'
          : `${selected?.label ?? 'Síntoma'} ${intensityLabel}`,
      timeLabel: formatTimeLabel(timestamp),
    }

    const handleApiSave = async (): Promise<void> => {
      try {
        await apiClient.post<unknown>(API_ENDPOINTS.events.create, payload)
      } catch {
        setSaving(false)
      }
    }

    setRecords((current) => {
      const next = [record, ...current]
      persistLocalRecords(next)
      return next
    })
    resetForm()
    setSaving(false)
    showToast('Registro guardado correctamente.')
    void handleApiSave()
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

        <section className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-blue-950">
              Registro
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Registra eventos y síntomas manualmente para el seguimiento
              preventivo.
            </p>
          </div>
          <button
            type="button"
            disabled
            title="Disponible en Plan Premium"
            className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-400"
          >
            <Lock className="size-4" aria-hidden="true" />
            Exportar reporte PDF
          </button>
        </section>

        <section className="mt-6 flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-blue-100">
            <User className="size-7 text-blue-600" aria-hidden="true" />
          </span>
          <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
            <PatientStat label="Paciente" value="***REMOVED*** M." />
            <PatientStat
              label="Estado"
              value={
                <>
                  <span
                    className="size-2 rounded-full bg-emerald-500"
                    aria-hidden="true"
                  />
                  Estable
                </>
              }
            />
            <PatientStat label="Dispositivo" value="Smartwatch G3" />
            <PatientStat label="Sincronización" value="Hace 5 min" />
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-3">
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void handleSubmit()
            }}
            className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2"
          >
            <span className="absolute right-5 top-5 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Plan Básico
            </span>

            <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <Plus className="size-6 text-blue-600" aria-hidden="true" />
              Nuevo registro
            </h2>

            <div className="mt-6 grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="event-date"
                  className="block text-sm font-medium text-slate-700"
                >
                  Fecha
                </label>
                <input
                  id="event-date"
                  type="date"
                  value={formDate}
                  onChange={(event) => setFormDate(event.target.value)}
                  className={`mt-1.5 ${inputClass}`}
                />
              </div>
              <div>
                <label
                  htmlFor="event-time"
                  className="block text-sm font-medium text-slate-700"
                >
                  Hora
                </label>
                <input
                  id="event-time"
                  type="time"
                  value={formTime}
                  onChange={(event) => setFormTime(event.target.value)}
                  className={`mt-1.5 ${inputClass}`}
                />
              </div>
            </div>

            <div className="mt-5">
              <label
                htmlFor="symptom-type"
                className="block text-sm font-medium text-slate-700"
              >
                Tipo de síntoma
              </label>
              <select
                id="symptom-type"
                value={symptom}
                onChange={(event) => setSymptom(event.target.value)}
                className={`mt-1.5 ${inputClass}`}
              >
                <option value="">Selecciona un síntoma</option>
                {SYMPTOMS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-5">
              <p className="text-sm font-medium text-slate-700">
                Accesos rápidos
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {SYMPTOMS.map((option) => {
                  const active = symptom === option.value
                  const isNoSymptoms = option.value === 'no-symptoms'
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setSymptom(active ? '' : option.value)}
                      aria-pressed={active}
                      className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                        active
                          ? isNoSymptoms
                            ? 'border-emerald-500 bg-emerald-500 text-white'
                            : 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-300 bg-white text-slate-600 hover:border-blue-400 hover:text-blue-700'
                      }`}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="symptom-intensity"
                  className="text-sm font-medium text-slate-700"
                >
                  Intensidad
                </label>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
                  {intensityLabel}
                </span>
              </div>
              <input
                id="symptom-intensity"
                type="range"
                min={1}
                max={5}
                step={1}
                value={intensity}
                onChange={(event) => setIntensity(Number(event.target.value))}
                aria-valuetext={intensityLabel}
                className="mt-3 w-full accent-blue-600"
              />
              <div className="mt-1 flex justify-between text-[11px] font-semibold tracking-wide text-slate-400">
                <span>MUY LEVE</span>
                <span>CRÓNICA</span>
              </div>
            </div>

            <div className="mt-5">
              <label
                htmlFor="event-notes"
                className="block text-sm font-medium text-slate-700"
              >
                Notas opcionales / Detonante
              </label>
              <textarea
                id="event-notes"
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Ej: Después de caminar 15 min, sentí una pequeña presión..."
                className={`mt-1.5 resize-none ${inputClass}`}
              />
              <p className="mt-1.5 text-xs text-slate-400">
                Esta información ayuda a construir el diario de salud del
                paciente.
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Guardando...' : 'Guardar registro'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          </form>

          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Registros Recientes
                </h3>
                <div className="flex gap-2">
                  <button
                    type="button"
                    aria-label="Filtrar registros"
                    className="rounded-lg border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-50"
                  >
                    <Filter className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label="Ver calendario"
                    className="rounded-lg border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-50"
                  >
                    <CalendarDays className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <ul className="mt-4 space-y-1.5">
                {records.map((record, index) => {
                  const isNoSymptoms = record.emoji === '✓'
                  return (
                    <li key={`${record.id}-${index}`}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-slate-50"
                      >
                        <span
                          className={`flex size-9 shrink-0 items-center justify-center rounded-full text-base ${
                            isNoSymptoms
                              ? 'bg-emerald-100'
                              : 'bg-slate-100'
                          }`}
                          aria-hidden="true"
                        >
                          {record.emoji}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-800">
                            {record.name}
                          </span>
                          <span className="block text-xs text-slate-500">
                            {record.timeLabel}
                          </span>
                        </span>
                        <ChevronRight
                          className="size-4 shrink-0 text-slate-300"
                          aria-hidden="true"
                        />
                      </button>
                    </li>
                  )
                })}
              </ul>

              <button
                type="button"
                onClick={() =>
                  showToast(
                    'El historial completo está disponible en Premium.',
                  )
                }
                className="mt-3 text-sm font-medium text-blue-600 transition-colors hover:text-blue-700 hover:underline"
              >
                Ver todo el historial
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Análisis de Tendencias
              </h3>
              <div className="relative mt-4 h-36 overflow-hidden rounded-xl bg-slate-50">
                <div
                  className="pointer-events-none flex h-full select-none items-end justify-center gap-1.5 blur-[2px]"
                  aria-hidden="true"
                >
                  {trendBars.map((height, index) => (
                    <span
                      key={index}
                      className="w-2.5 rounded-full bg-blue-200"
                      style={{ height: `${height}%` }}
                    />
                  ))}
                </div>
                <Activity
                  className="absolute left-1/2 top-1/2 size-20 -translate-x-1/2 -translate-y-1/2 text-blue-200/60"
                  aria-hidden="true"
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5">
                  <span className="flex size-12 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-slate-200/60">
                    <Lock className="size-5 text-slate-500" aria-hidden="true" />
                  </span>
                  <p className="text-sm font-semibold text-slate-700">
                    🔒 Disponible en Premium
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-6 text-white shadow-lg">
              <div className="flex items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/10">
                  <Star className="size-6 fill-current" aria-hidden="true" />
                </span>
                <h3 className="text-lg font-bold">Mejora a Premium</h3>
              </div>
              <p className="mt-3 text-sm text-blue-100">
                Desbloquea análisis avanzados, reportes mensuales y alertas
                predictivas.
              </p>
              <Link
                to="/planes"
                className="mt-5 inline-flex rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50"
              >
                Actualizar ahora
              </Link>
            </div>
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
                <AlertTriangle
                  className="size-6 text-red-600"
                  aria-hidden="true"
                />
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
              para ***REMOVED***.
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

      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full px-5 py-2.5 text-sm font-medium text-white shadow-lg ${
            toast.tone === 'success' ? 'bg-emerald-600' : 'bg-red-600'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}